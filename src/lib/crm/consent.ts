import { db } from "@/lib/db";
import { CustomerNotFoundError, ConsentError } from "./errors";
import type { NotificationChannel } from "@prisma/client";

// Consentement (Phase 10) — RÈGLE FONDAMENTALE : aucune campagne marketing
// ne doit jamais être envoyée sans marketingOptIn = true. Les notifications
// transactionnelles existantes (Phases 0-9 : confirmation de demande,
// devis disponible, facture, etc.) restent inchangées et non concernées —
// seul un envoi de type Campaign (marketing) est soumis à cette garde, voir
// docs/CRM.md, section "Transactionnel vs marketing".

export type ConsentInput = Partial<{
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
  marketingOptIn: boolean;
}>;

const CHANNEL_OPT_IN_FIELD: Record<NotificationChannel, keyof ConsentInput | null> = {
  WHATSAPP: "whatsappOptIn",
  EMAIL: "emailOptIn",
  SMS: "smsOptIn",
  IN_APP: null, // pas de consentement dédié — canal interne, jamais utilisé pour une campagne.
};

export async function getConsent(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      whatsappOptIn: true,
      emailOptIn: true,
      smsOptIn: true,
      marketingOptIn: true,
      consentGivenAt: true,
      consentSource: true,
      consentRevokedAt: true,
    },
  });
  if (!customer) throw new CustomerNotFoundError();
  return customer;
}

// source : "CLIENT_PORTAL" (le client modifie lui-même ses préférences
// depuis "Mon espace") ou "PRODUCTION_STAFF" (recueilli oralement/par
// écrit par la production) — jamais un texte libre arbitraire, fixé par
// l'appelant serveur (voir routes API).
export async function updateConsent(customerId: string, input: ConsentInput, source: "CLIENT_PORTAL" | "PRODUCTION_STAFF") {
  const current = await getConsent(customerId);
  const wasMarketingOptIn = current.marketingOptIn;
  const willBeMarketingOptIn = input.marketingOptIn ?? current.marketingOptIn;

  const now = new Date();
  const updated = await db.customer.update({
    where: { id: customerId },
    data: {
      ...input,
      consentGivenAt: !wasMarketingOptIn && willBeMarketingOptIn ? now : current.consentGivenAt,
      consentSource: !wasMarketingOptIn && willBeMarketingOptIn ? source : current.consentSource,
      consentRevokedAt: wasMarketingOptIn && willBeMarketingOptIn === false ? now : current.consentRevokedAt,
    },
  });

  await db.auditLog.create({
    data: {
      action: "CONSENT_UPDATED",
      entity: "Customer",
      entityId: customerId,
      oldValue: {
        whatsappOptIn: current.whatsappOptIn,
        emailOptIn: current.emailOptIn,
        smsOptIn: current.smsOptIn,
        marketingOptIn: current.marketingOptIn,
      },
      newValue: { ...input, source },
    },
  });

  return updated;
}

// Garde unique appelée avant TOUT envoi marketing (Campaign) — jamais pour
// les notifications transactionnelles existantes. Lève si le
// marketingOptIn global est faux OU si le canal spécifique n'est pas
// consenti.
export function assertMarketingConsent(
  customer: { marketingOptIn: boolean; whatsappOptIn: boolean; emailOptIn: boolean; smsOptIn: boolean },
  channel: NotificationChannel
) {
  if (!customer.marketingOptIn) {
    throw new ConsentError("Ce client n'a pas consenti à recevoir des communications marketing.");
  }
  const field = CHANNEL_OPT_IN_FIELD[channel];
  if (field && !customer[field]) {
    throw new ConsentError(`Ce client n'a pas consenti au canal ${channel} pour le marketing.`);
  }
}

export function hasMarketingConsent(
  customer: { marketingOptIn: boolean; whatsappOptIn: boolean; emailOptIn: boolean; smsOptIn: boolean },
  channel: NotificationChannel
): boolean {
  try {
    assertMarketingConsent(customer, channel);
    return true;
  } catch {
    return false;
  }
}
