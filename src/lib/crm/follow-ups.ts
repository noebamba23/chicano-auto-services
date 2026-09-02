import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { CustomerNotFoundError, FollowUpNotFoundError, FollowUpConflictError } from "./errors";
import type { FollowUpStatus } from "@prisma/client";

// Relances commerciales (Phase 10) — motif + prochaine action, créable en
// production. Pas de déclenchement automatique dans ce projet (aucun
// scheduler, même limite documentée que markOverdueInvoices()/
// checkAndNotifyReminders()) : checkAndNotifyDueFollowUps() doit être
// appelé manuellement (route production dédiée).

const PAGE_SIZE = 20;

const ALLOWED_TRANSITIONS: Record<FollowUpStatus, FollowUpStatus[]> = {
  PENDING: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export async function createFollowUp(
  createdById: string,
  input: { customerId: string; reason: string; dueAt: string; notes?: string; assignedToId?: string }
) {
  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
  if (!customer) throw new CustomerNotFoundError();

  const followUp = await db.followUp.create({
    data: {
      customerId: input.customerId,
      reason: input.reason,
      dueAt: new Date(input.dueAt),
      notes: input.notes || null,
      assignedToId: input.assignedToId || null,
      createdById,
    },
  });

  await db.auditLog.create({
    data: { action: "FOLLOW_UP_CREATED", entity: "FollowUp", entityId: followUp.id, newValue: { reason: input.reason } },
  });

  return followUp;
}

export async function listFollowUpsForCustomer(customerId: string, page = 1) {
  const skip = Math.max(0, (page - 1) * PAGE_SIZE);
  const [items, total] = await Promise.all([
    db.followUp.findMany({ where: { customerId }, orderBy: { dueAt: "asc" }, skip, take: PAGE_SIZE }),
    db.followUp.count({ where: { customerId } }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export interface FollowUpProductionFilters {
  status?: FollowUpStatus;
}

export function listFollowUpsForProduction(filters: FollowUpProductionFilters = {}) {
  return db.followUp.findMany({
    where: { status: filters.status },
    orderBy: { dueAt: "asc" },
  });
}

async function getFollowUpOrThrow(id: string) {
  const followUp = await db.followUp.findUnique({ where: { id } });
  if (!followUp) throw new FollowUpNotFoundError();
  return followUp;
}

function assertTransition(current: FollowUpStatus, target: FollowUpStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new FollowUpConflictError(`Transition impossible : une relance ${current} ne peut pas passer à ${target}.`);
  }
}

export async function completeFollowUp(id: string) {
  const followUp = await getFollowUpOrThrow(id);
  assertTransition(followUp.status, "DONE");
  return db.followUp.update({ where: { id }, data: { status: "DONE", completedAt: new Date() } });
}

export async function cancelFollowUp(id: string) {
  const followUp = await getFollowUpOrThrow(id);
  assertTransition(followUp.status, "CANCELLED");
  return db.followUp.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
}

// Déclenchement manuel (pas de cron dans ce projet) — notifie l'équipe
// assignée pour toute relance PENDING échue. Idempotent au niveau
// applicatif : n'envoie qu'une fois par relance grâce à FOLLOW_UP_DUE déjà
// consigné dans Notification (vérifié par appelant si besoin d'éviter les
// doublons répétés — non bloquant ici, action manuelle explicite).
export async function checkAndNotifyDueFollowUps() {
  const due = await db.followUp.findMany({
    where: { status: "PENDING", dueAt: { lte: new Date() } },
  });

  let notified = 0;
  for (const followUp of due) {
    if (!followUp.assignedToId) continue;
    await sendNotification(followUp.assignedToId, "FOLLOW_UP_DUE", { reason: followUp.reason });
    notified += 1;
  }

  return { checked: due.length, notified };
}
