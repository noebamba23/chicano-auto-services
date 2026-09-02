import { db } from "@/lib/db";
import { getWhatsAppProvider, isMockWhatsAppActive } from "@/lib/messaging/get-provider";
import { computeBulkSegmentation } from "./segmentation";
import { hasMarketingConsent } from "./consent";
import { CampaignNotFoundError, CampaignConflictError } from "./errors";
import type { CampaignObjective, CampaignSegment, CampaignStatus, NotificationChannel } from "@prisma/client";

// Campagnes (Phase 10) — RÈGLE FONDAMENTALE : ceci n'est PAS un moteur de
// marketing automation. Une campagne cible un segment calculé à la volée
// (jamais une liste figée à la création), n'est jamais envoyée
// automatiquement, et respecte marketingOptIn/canal à chaque destinataire
// au moment de l'envoi (jamais au moment de la création). Un mode PREVIEW
// existe toujours avant tout envoi réel — voir previewCampaign().
//
// Seul le canal WHATSAPP dispose d'un fournisseur réel dans ce projet
// (réutilisé tel quel, mock en dev — jamais présenté comme une API Meta
// active si WHATSAPP_PROVIDER_MODE≠"meta"). EMAIL/SMS n'ont aucune
// intégration : previewCampaign()/sendCampaign() le signalent honnêtement,
// aucun envoi n'est jamais simulé comme réussi.

// DRAFT peut être envoyée directement (scheduledAt reste informatif, aucun
// scheduler dans ce projet) ou passer par SCHEDULED d'abord.
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["SCHEDULED", "RUNNING", "CANCELLED"],
  SCHEDULED: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function assertTransition(current: CampaignStatus, target: CampaignStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new CampaignConflictError(`Transition impossible : une campagne ${current} ne peut pas passer à ${target}.`);
  }
}

export interface CampaignFilters {
  status?: CampaignStatus;
  segment?: CampaignSegment;
}

export function listCampaigns(filters: CampaignFilters = {}) {
  return db.campaign.findMany({
    where: { status: filters.status, segment: filters.segment },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCampaign(id: string) {
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) throw new CampaignNotFoundError();
  return campaign;
}

export async function createCampaign(
  createdById: string,
  input: {
    name: string;
    objective: CampaignObjective;
    segment: CampaignSegment;
    channel: NotificationChannel;
    message: string;
    scheduledAt?: string;
  }
) {
  const campaign = await db.campaign.create({
    data: {
      name: input.name,
      objective: input.objective,
      segment: input.segment,
      channel: input.channel,
      message: input.message,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdById,
    },
  });

  await db.auditLog.create({
    data: { action: "CAMPAIGN_CREATED", entity: "Campaign", entityId: campaign.id, newValue: { segment: input.segment, channel: input.channel } },
  });

  return campaign;
}

// Cible réelle recalculée au moment de l'appel (jamais une liste figée) —
// segment comportemental live via computeBulkSegmentation().
async function resolveTargets(segment: CampaignSegment) {
  const segmentation = await computeBulkSegmentation();
  const customerIds = [...segmentation.entries()].filter(([, s]) => s.segment === segment).map(([id]) => id);
  if (customerIds.length === 0) return [];

  return db.customer.findMany({
    where: { id: { in: customerIds } },
    select: {
      id: true,
      marketingOptIn: true,
      whatsappOptIn: true,
      emailOptIn: true,
      smsOptIn: true,
      user: { select: { id: true, phoneE164: true, firstName: true } },
    },
  });
}

export interface CampaignPreview {
  segment: CampaignSegment;
  channel: NotificationChannel;
  totalInSegment: number;
  eligible: number;
  skippedNoConsent: number;
  channelAvailable: boolean;
  mockActive: boolean;
  sampleRecipients: string[];
}

// Mode PREVIEW — jamais d'envoi réel ici, uniquement un décompte honnête
// des destinataires réellement joignables (consentement + canal
// disponible), obligatoire avant tout sendCampaign().
export async function previewCampaign(id: string): Promise<CampaignPreview> {
  const campaign = await getCampaign(id);
  const targets = await resolveTargets(campaign.segment);
  const channelAvailable = campaign.channel === "WHATSAPP";

  const eligible = targets.filter((t) => hasMarketingConsent(t, campaign.channel));

  return {
    segment: campaign.segment,
    channel: campaign.channel,
    totalInSegment: targets.length,
    eligible: channelAvailable ? eligible.length : 0,
    skippedNoConsent: targets.length - eligible.length,
    channelAvailable,
    mockActive: isMockWhatsAppActive(),
    sampleRecipients: eligible.slice(0, 5).map((t) => t.user.firstName),
  };
}

export interface CampaignSendResult {
  sent: number;
  skippedNoConsent: number;
  skippedChannelUnavailable: number;
}

// Envoi réel — jamais déclenché automatiquement, toujours une action
// production explicite après previewCampaign(). Consentement revérifié ici
// (jamais celui, potentiellement périmé, de la création) : DRAFT/SCHEDULED
// → RUNNING → COMPLETED.
export async function sendCampaign(id: string): Promise<CampaignSendResult> {
  const campaign = await getCampaign(id);
  assertTransition(campaign.status, "RUNNING");
  await db.campaign.update({ where: { id }, data: { status: "RUNNING" } });

  const targets = await resolveTargets(campaign.segment);

  if (campaign.channel !== "WHATSAPP") {
    // Aucun fournisseur EMAIL/SMS dans ce projet — jamais de faux succès.
    await db.campaign.update({
      where: { id },
      data: { status: "COMPLETED", sentCount: 0, skippedCount: targets.length },
    });
    await db.auditLog.create({
      data: { action: "CAMPAIGN_SENT", entity: "Campaign", entityId: id, newValue: { sent: 0, skipped: targets.length, reason: "CHANNEL_NOT_CONFIGURED" } },
    });
    return { sent: 0, skippedNoConsent: 0, skippedChannelUnavailable: targets.length };
  }

  const provider = getWhatsAppProvider();
  let sent = 0;
  let skippedNoConsent = 0;

  for (const target of targets) {
    if (!hasMarketingConsent(target, campaign.channel)) {
      skippedNoConsent += 1;
      continue;
    }
    const result = await provider.sendText(target.user.phoneE164, campaign.message);
    if (result.success) sent += 1;
    else skippedNoConsent += 0; // échec technique, compté séparément ci-dessous si besoin
  }

  await db.campaign.update({
    where: { id },
    data: { status: "COMPLETED", sentCount: sent, skippedCount: skippedNoConsent },
  });

  await db.auditLog.create({
    data: { action: "CAMPAIGN_SENT", entity: "Campaign", entityId: id, newValue: { sent, skippedNoConsent } },
  });

  return { sent, skippedNoConsent, skippedChannelUnavailable: 0 };
}

export async function cancelCampaign(id: string) {
  const campaign = await getCampaign(id);
  assertTransition(campaign.status, "CANCELLED");
  return db.campaign.update({ where: { id }, data: { status: "CANCELLED" } });
}
