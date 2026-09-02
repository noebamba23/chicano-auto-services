import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { CustomerNotFoundError, CarePlanNotFoundError, CareSubscriptionNotFoundError, CareConflictError } from "./errors";
import type { CareSubscriptionStatus } from "@prisma/client";

// CHICANO CARE (Phase 10) — offre commerciale d'abonnement, prix/durée/
// fréquence libres (jamais imposés en dur). RÈGLE FONDAMENTALE : aucun
// paiement récurrent automatique dans cette phase — CareSubscription ne
// fait que suivre la relation (statut/dates), tout encaissement reste le
// flux manuel existant de la Phase 9 (recordPayment). Réutilise
// MaintenancePlan/MaintenanceReminder tels quels : aucune modification du
// moteur de maintenance.

const ALLOWED_TRANSITIONS: Record<CareSubscriptionStatus, CareSubscriptionStatus[]> = {
  ACTIVE: ["PAUSED", "CANCELLED", "EXPIRED"],
  PAUSED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CANCELLED: [],
  EXPIRED: [],
};

// ============================================================
// CAREPLAN — catalogue, ADMIN/SUPER_ADMIN uniquement en écriture (voir
// requireAdminRole côté route).
// ============================================================

export function listCarePlans(includeInactive = false) {
  return db.carePlan.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCarePlan(id: string) {
  const plan = await db.carePlan.findUnique({ where: { id } });
  if (!plan) throw new CarePlanNotFoundError();
  return plan;
}

export async function createCarePlan(input: {
  name: string;
  description?: string;
  price: number;
  durationMonths: number;
  frequencyMonths: number;
  includedServices: string[];
}) {
  return db.carePlan.create({
    data: {
      name: input.name,
      description: input.description || null,
      price: input.price,
      durationMonths: input.durationMonths,
      frequencyMonths: input.frequencyMonths,
      includedServices: input.includedServices,
    },
  });
}

export async function updateCarePlan(
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    price: number;
    durationMonths: number;
    frequencyMonths: number;
    includedServices: string[];
    active: boolean;
  }>
) {
  await getCarePlan(id);
  return db.carePlan.update({ where: { id }, data: input });
}

// ============================================================
// CARESUBSCRIPTION — production propose/active un plan pour un client
// (pas d'auto-souscription client dans cette phase, cohérent avec
// l'absence de paiement récurrent automatique).
// ============================================================

const SUBSCRIPTION_INCLUDE = {
  carePlan: true,
  vehicle: { select: { id: true, make: true, model: true, chicanoVehicleId: true } },
} as const;

export async function createCareSubscription(input: { customerId: string; carePlanId: string; vehicleId?: string }) {
  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true, userId: true } });
  if (!customer) throw new CustomerNotFoundError();
  const plan = await getCarePlan(input.carePlanId);
  if (!plan.active) throw new CareConflictError("Ce plan CHICANO CARE n'est plus proposé.");

  const subscription = await db.careSubscription.create({
    data: {
      customerId: input.customerId,
      carePlanId: input.carePlanId,
      vehicleId: input.vehicleId || null,
    },
  });

  await db.auditLog.create({
    data: { action: "CARE_SUBSCRIPTION_CREATED", entity: "CareSubscription", entityId: subscription.id, newValue: { carePlanId: input.carePlanId } },
  });

  await sendNotification(customer.userId, "CARE_STARTED", { plan: plan.name });

  return db.careSubscription.findUnique({ where: { id: subscription.id }, include: SUBSCRIPTION_INCLUDE });
}

export function listCareSubscriptionsForCustomer(customerId: string) {
  return db.careSubscription.findMany({
    where: { customerId },
    include: SUBSCRIPTION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

async function getSubscriptionOrThrow(id: string) {
  const sub = await db.careSubscription.findUnique({ where: { id }, include: SUBSCRIPTION_INCLUDE });
  if (!sub) throw new CareSubscriptionNotFoundError();
  return sub;
}

function assertTransition(current: CareSubscriptionStatus, target: CareSubscriptionStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new CareConflictError(`Transition impossible : un abonnement ${current} ne peut pas passer à ${target}.`);
  }
}

async function transitionSubscription(id: string, target: CareSubscriptionStatus) {
  const sub = await getSubscriptionOrThrow(id);
  assertTransition(sub.status as CareSubscriptionStatus, target);

  const data: { status: CareSubscriptionStatus; endedAt?: Date } =
    target === "CANCELLED" || target === "EXPIRED" ? { status: target, endedAt: new Date() } : { status: target };

  await db.careSubscription.update({ where: { id }, data });
  await db.auditLog.create({ data: { action: `CARE_SUBSCRIPTION_${target}`, entity: "CareSubscription", entityId: id } });

  const customer = await db.customer.findUnique({ where: { id: sub.customerId }, select: { userId: true } });
  if (customer && target === "EXPIRED") {
    await sendNotification(customer.userId, "CARE_EXPIRED", { plan: sub.carePlan.name });
  }

  return getSubscriptionOrThrow(id);
}

export const pauseCareSubscription = (id: string) => transitionSubscription(id, "PAUSED");
export const resumeCareSubscription = (id: string) => transitionSubscription(id, "ACTIVE");
export const cancelCareSubscription = (id: string) => transitionSubscription(id, "CANCELLED");
export const expireCareSubscription = (id: string) => transitionSubscription(id, "EXPIRED");

// Déclenchement manuel (pas de cron) — signale les abonnements ACTIVE dont
// la durée du plan est dépassée depuis startedAt, notifie une seule fois
// (CARE_EXPIRING) avant l'échéance effective. Même limite documentée que
// markOverdueInvoices()/checkAndNotifyReminders().
export async function checkExpiringCareSubscriptions(warningDays = 14) {
  const active = await db.careSubscription.findMany({
    where: { status: "ACTIVE" },
    include: SUBSCRIPTION_INCLUDE,
  });

  let warned = 0;
  const now = Date.now();
  for (const sub of active) {
    const endsAt = new Date(sub.startedAt);
    endsAt.setMonth(endsAt.getMonth() + sub.carePlan.durationMonths);
    const daysRemaining = (endsAt.getTime() - now) / 86_400_000;

    if (daysRemaining <= 0) {
      await transitionSubscription(sub.id, "EXPIRED");
      continue;
    }
    if (daysRemaining <= warningDays) {
      const customer = await db.customer.findUnique({ where: { id: sub.customerId }, select: { userId: true } });
      if (customer) {
        await sendNotification(customer.userId, "CARE_EXPIRING", { plan: sub.carePlan.name });
        warned += 1;
      }
    }
  }

  return { checked: active.length, warned };
}
