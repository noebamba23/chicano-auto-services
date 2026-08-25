import { db } from "@/lib/db";
import { getWhatsAppProvider } from "@/lib/messaging/get-provider";
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
    const provider = getWhatsAppProvider();
    const result = await provider.sendText(user.phoneE164, body);
    await db.notification.update({
      where: { id: notification.id },
      data: { status: result.success ? "SENT" : "FAILED", sentAt: result.success ? new Date() : null },
    });
    return { ...notification, success: result.success };
  } catch (err) {
    await db.notification.update({ where: { id: notification.id }, data: { status: "FAILED" } });
    console.error(`Échec notification ${event} pour ${userId}:`, err);
    return { ...notification, success: false };
  }
}
