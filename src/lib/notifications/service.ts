import { db } from "@/lib/db";
import { getWhatsAppProvider, isMockWhatsAppActive } from "@/lib/messaging/get-provider";
import type { MessageSendResult } from "@/lib/messaging/provider";
import { META_TEMPLATE_MAP } from "./meta-template-map";
import type { NotificationEvent } from "@prisma/client";

// Abstraction de notification (section "NOTIFICATIONS" de la Phase 3) :
// résout le template de l'événement, interpole les variables, envoie via le
// canal WhatsApp déjà en place (mock en dev, Meta Cloud API si configuré —
// jamais présenté comme actif si WHATSAPP_PROVIDER_MODE≠"meta", cf.
// src/lib/messaging/get-provider.ts) et journalise l'envoi.
//
// Ne bloque jamais l'opération métier appelante : un échec d'envoi est
// consigné (status FAILED) mais ne fait pas échouer la transaction qui l'a
// déclenché (ex. l'acceptation d'une demande reste valide même si la
// notification WhatsApp échoue).

function interpolate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? "");
}

// Mode mock : texte libre inchangé (comportement historique, aucun réseau
// réel). Mode meta : un OTP ou une notification initiés par l'entreprise
// exigent un template WhatsApp pré-approuvé hors fenêtre de conversation
// ouverte par le client — jamais de repli silencieux vers sendText(), qui
// serait de toute façon rejeté par Meta. Sans template configuré pour cet
// événement, l'échec est explicite et observable (voir META_TEMPLATE_MAP).
async function sendViaProvider(
  event: NotificationEvent,
  phoneE164: string,
  body: string,
  variables: Record<string, string>
): Promise<MessageSendResult> {
  const provider = getWhatsAppProvider();

  if (isMockWhatsAppActive()) {
    return provider.sendText(phoneE164, body);
  }

  const mapping = META_TEMPLATE_MAP[event];
  if (!mapping || !mapping.templateName || !provider.sendTemplate) {
    return {
      success: false,
      error: `Aucun template Meta configuré pour l'événement ${event}.`,
    };
  }

  const templateParams: Record<string, string> = {};
  for (const key of mapping.paramKeys) {
    templateParams[key] = variables[key] ?? "";
  }

  return provider.sendTemplate(phoneE164, mapping.templateName, templateParams);
}

export async function sendNotification(
  userId: string,
  event: NotificationEvent,
  variables: Record<string, string> = {}
) {
  const [user, template] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { phoneE164: true } }),
    db.notificationTemplate.findUnique({ where: { event } }),
  ]);

  if (!user) return null;

  const body = template?.isActive
    ? interpolate(template.bodyTemplate, variables)
    : `CHICANO AUTO SERVICES — ${event}`;

  const notification = await db.notification.create({
    data: { userId, event, channel: template?.channel ?? "WHATSAPP", status: "PENDING", payload: variables },
  });

  try {
    const result = await sendViaProvider(event, user.phoneE164, body, variables);
    await db.notification.update({
      where: { id: notification.id },
      data: { status: result.success ? "SENT" : "FAILED", sentAt: result.success ? new Date() : null },
    });
    if (!result.success) {
      console.error(`Échec notification ${event} pour ${userId}: ${result.error ?? "erreur inconnue"}`);
    }
    return { ...notification, success: result.success, error: result.success ? undefined : result.error };
  } catch (err) {
    await db.notification.update({ where: { id: notification.id }, data: { status: "FAILED" } });
    console.error(`Échec notification ${event} pour ${userId}:`, err);
    return { ...notification, success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}
