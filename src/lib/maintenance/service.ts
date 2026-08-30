import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { getVehicleForCustomer, VehicleNotFoundError } from "@/lib/vehicles/service";
import { createServiceRequest } from "@/lib/service-requests/service";
import { maintenanceTypeLabel } from "./options";
import type { MaintenanceType, MaintenanceReminderLevel, WorkOrderPriority } from "@prisma/client";

// Carnet d'entretien / rappels (Phase 8) — RÈGLE FONDAMENTALE : pas de
// deuxième historique parallèle, MaintenancePlan/MaintenanceReminder restent
// les seules tables dédiées (posées en Phase 0, confirmées vides avant
// modification). Un entretien n'est jamais déclaré réalisé par le client —
// seul completeMaintenanceFromWorkOrder() (appelé depuis
// work-orders/service.ts::passQualityCheck) peut clore un rappel.

export class MaintenancePlanNotFoundError extends Error {
  constructor() {
    super("Plan d'entretien introuvable.");
    this.name = "MaintenancePlanNotFoundError";
  }
}

export class MaintenanceReminderNotFoundError extends Error {
  constructor() {
    super("Rappel d'entretien introuvable.");
    this.name = "MaintenanceReminderNotFoundError";
  }
}

export class MaintenanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaintenanceConflictError";
  }
}

// Seuils opérationnels par défaut (pas une donnée constructeur vérifiée —
// simple réglage applicatif documenté, voir docs/MAINTENANCE.md).
const UPCOMING_DAYS = 30;
const DUE_DAYS = 7;
const UPCOMING_KM = 500;
const DUE_KM = 100;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Le premier seuil atteint (date OU kilométrage) détermine le niveau —
// renvoie le plus urgent des deux si les deux sont définis.
export function computeReminderLevel(
  reminder: { dueAt: Date | null; dueMileage: number | null },
  currentMileage: number | null
): MaintenanceReminderLevel | null {
  const levels: MaintenanceReminderLevel[] = [];
  const now = Date.now();

  if (reminder.dueAt) {
    const daysUntil = (reminder.dueAt.getTime() - now) / 86_400_000;
    if (daysUntil < 0) levels.push("OVERDUE");
    else if (daysUntil <= DUE_DAYS) levels.push("DUE");
    else if (daysUntil <= UPCOMING_DAYS) levels.push("UPCOMING");
  }

  if (reminder.dueMileage !== null && currentMileage !== null) {
    const kmRemaining = reminder.dueMileage - currentMileage;
    if (kmRemaining < 0) levels.push("OVERDUE");
    else if (kmRemaining <= DUE_KM) levels.push("DUE");
    else if (kmRemaining <= UPCOMING_KM) levels.push("UPCOMING");
  }

  if (levels.length === 0) return null;
  const order: Record<MaintenanceReminderLevel, number> = { UPCOMING: 1, DUE: 2, OVERDUE: 3 };
  return levels.reduce((worst, level) => (order[level] > order[worst] ? level : worst));
}

// ============================================================
// PLANS — production/admin uniquement.
// ============================================================

export function listPlansForVehicle(vehicleId: string) {
  return db.maintenancePlan.findMany({ where: { vehicleId }, orderBy: { createdAt: "asc" } });
}

export async function createMaintenancePlan(
  vehicleId: string,
  input: { type: MaintenanceType; intervalKm?: number; intervalMonths?: number; priority?: WorkOrderPriority }
) {
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
  if (!vehicle) throw new VehicleNotFoundError();
  if (!input.intervalKm && !input.intervalMonths) {
    throw new MaintenanceConflictError("Un plan doit avoir au moins un intervalle (kilométrique ou temporel).");
  }

  const plan = await db.maintenancePlan.create({
    data: {
      vehicleId,
      type: input.type,
      intervalKm: input.intervalKm ?? null,
      intervalMonths: input.intervalMonths ?? null,
      priority: input.priority ?? "NORMAL",
    },
  });

  await db.auditLog.create({
    data: { action: "MAINTENANCE_PLAN_CREATED", entity: "MaintenancePlan", entityId: plan.id, newValue: input },
  });

  return plan;
}

export async function updateMaintenancePlan(
  planId: string,
  input: { intervalKm?: number | null; intervalMonths?: number | null; priority?: WorkOrderPriority; isActive?: boolean }
) {
  const existing = await db.maintenancePlan.findUnique({ where: { id: planId } });
  if (!existing) throw new MaintenancePlanNotFoundError();

  const plan = await db.maintenancePlan.update({ where: { id: planId }, data: input });

  await db.auditLog.create({
    data: { action: "MAINTENANCE_PLAN_UPDATED", entity: "MaintenancePlan", entityId: planId, newValue: input },
  });

  return plan;
}

// ============================================================
// RAPPELS — création manuelle (production) ou automatique (voir
// completeMaintenanceFromWorkOrder ci-dessous).
// ============================================================

export function listRemindersForVehicle(vehicleId: string) {
  return db.maintenanceReminder.findMany({ where: { vehicleId }, orderBy: { createdAt: "desc" } });
}

export async function createMaintenanceReminder(
  vehicleId: string,
  input: {
    type: MaintenanceType;
    dueAt?: string;
    dueMileage?: number;
    priority?: WorkOrderPriority;
    notes?: string;
    planId?: string;
  }
) {
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
  if (!vehicle) throw new VehicleNotFoundError();
  if (!input.dueAt && input.dueMileage === undefined) {
    throw new MaintenanceConflictError("Un rappel doit avoir au moins une échéance (date ou kilométrage).");
  }

  const reminder = await db.maintenanceReminder.create({
    data: {
      vehicleId,
      planId: input.planId ?? null,
      type: input.type,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      dueMileage: input.dueMileage ?? null,
      priority: input.priority ?? "NORMAL",
      notes: input.notes || null,
      status: "SCHEDULED",
    },
  });

  await db.auditLog.create({
    data: { action: "MAINTENANCE_REMINDER_CREATED", entity: "MaintenanceReminder", entityId: reminder.id, newValue: input },
  });

  return reminder;
}

export async function cancelMaintenanceReminder(reminderId: string, reason?: string) {
  const existing = await db.maintenanceReminder.findUnique({ where: { id: reminderId } });
  if (!existing) throw new MaintenanceReminderNotFoundError();
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new MaintenanceConflictError("Ce rappel est déjà clos.");
  }

  const reminder = await db.maintenanceReminder.update({
    where: { id: reminderId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await db.auditLog.create({
    data: { action: "MAINTENANCE_REMINDER_CANCELLED", entity: "MaintenanceReminder", entityId: reminderId, newValue: { reason } },
  });

  return reminder;
}

// ============================================================
// DÉCLENCHEMENT DES NOTIFICATIONS — pensé pour être appelé périodiquement
// (aucun scheduler/cron n'existe dans ce projet ; exposé via une route
// production déclenchable manuellement, voir docs/MAINTENANCE.md pour cette
// limite assumée). Anti-spam : ne renvoie jamais deux fois le même palier.
// ============================================================

export async function checkAndNotifyReminders() {
  const reminders = await db.maintenanceReminder.findMany({
    where: { status: { in: ["PENDING", "SCHEDULED", "SENT"] } },
    include: { vehicle: { select: { id: true, mileage: true, make: true, model: true, customerId: true } } },
  });

  let notified = 0;
  for (const reminder of reminders) {
    const level = computeReminderLevel(reminder, reminder.vehicle.mileage);
    if (!level || level === reminder.lastNotifiedLevel) continue;

    const customer = await db.customer.findUnique({
      where: { id: reminder.vehicle.customerId },
      select: { userId: true },
    });
    if (customer) {
      const event = level === "UPCOMING" ? "MAINTENANCE_UPCOMING" : level === "DUE" ? "MAINTENANCE_DUE" : "MAINTENANCE_OVERDUE";
      await sendNotification(customer.userId, event, {
        vehicle: `${reminder.vehicle.make} ${reminder.vehicle.model}`,
        maintenanceType: maintenanceTypeLabel(reminder.type),
      });
    }

    await db.maintenanceReminder.update({
      where: { id: reminder.id },
      data: { lastNotifiedLevel: level, lastNotifiedAt: new Date(), status: "SENT" },
    });
    notified++;
  }

  return { checked: reminders.length, notified };
}

// ============================================================
// CLÔTURE DEPUIS UN WORK ORDER — un entretien n'est réalisé QUE lorsqu'il
// est relié à une intervention réellement terminée (jamais déclaré par le
// client). Appelé depuis work-orders/service.ts::passQualityCheck().
// ============================================================

export async function completeMaintenanceFromWorkOrder(workOrderId: string) {
  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: { items: true, vehicle: { select: { id: true, mileage: true } } },
  });
  if (!workOrder) return;

  const maintenanceTypes = [...new Set(workOrder.items.map((i) => i.maintenanceType).filter((t): t is MaintenanceType => t !== null))];
  if (maintenanceTypes.length === 0) return;

  const doneAt = workOrder.qualityCheckedAt ?? new Date();
  const doneMileage = workOrder.vehicle.mileage;

  for (const type of maintenanceTypes) {
    await db.maintenanceReminder.updateMany({
      where: { vehicleId: workOrder.vehicleId, type, status: { in: ["PENDING", "SCHEDULED", "SENT"] } },
      data: { status: "COMPLETED", completedAt: doneAt, completedByWorkOrderId: workOrder.id },
    });

    const plan = await db.maintenancePlan.findFirst({ where: { vehicleId: workOrder.vehicleId, type, isActive: true } });
    if (plan) {
      await db.maintenancePlan.update({
        where: { id: plan.id },
        data: { lastDoneAt: doneAt, lastDoneMileage: doneMileage },
      });

      const nextDueAt = plan.intervalMonths ? addMonths(doneAt, plan.intervalMonths) : null;
      const nextDueMileage = plan.intervalKm && doneMileage !== null ? doneMileage + plan.intervalKm : null;

      if (nextDueAt || nextDueMileage) {
        await db.maintenanceReminder.create({
          data: {
            vehicleId: workOrder.vehicleId,
            planId: plan.id,
            type,
            dueAt: nextDueAt,
            dueMileage: nextDueMileage,
            priority: plan.priority,
            status: "SCHEDULED",
          },
        });
      }
    }

    await db.auditLog.create({
      data: {
        action: "MAINTENANCE_COMPLETED",
        entity: "WorkOrder",
        entityId: workOrder.id,
        newValue: { type, doneAt, doneMileage },
      },
    });
  }
}

// ============================================================
// RAPPEL → SERVICE REQUEST — réutilise createServiceRequest() existant,
// jamais un Appointment créé directement (section "RAPPEL → SERVICE
// REQUEST").
// ============================================================

export async function createServiceRequestFromReminder(customerId: string, reminderId: string) {
  const reminder = await db.maintenanceReminder.findFirst({
    where: { id: reminderId, vehicle: { customerId } },
  });
  if (!reminder) throw new MaintenanceReminderNotFoundError();

  return createServiceRequest(customerId, {
    vehicleId: reminder.vehicleId,
    category: "MAINTENANCE",
    description: `Entretien programmé : ${maintenanceTypeLabel(reminder.type)}.`,
    interventionType: "AT_GARAGE",
    isUrgent: false,
  });
}

// ============================================================
// ESPACE CLIENT — ownership.
// ============================================================

export async function getVehicleMaintenanceForCustomer(customerId: string, vehicleId: string) {
  const vehicle = await getVehicleForCustomer(customerId, vehicleId);
  const [plans, reminders] = await Promise.all([listPlansForVehicle(vehicleId), listRemindersForVehicle(vehicleId)]);

  const activeReminders = reminders
    .filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED")
    .map((r) => ({ ...r, level: computeReminderLevel(r, vehicle.mileage) }))
    .sort((a, b) => {
      const order = { OVERDUE: 0, DUE: 1, UPCOMING: 2 } as Record<string, number>;
      return (order[a.level ?? "UPCOMING"] ?? 3) - (order[b.level ?? "UPCOMING"] ?? 3);
    });

  return { plans, reminders: activeReminders, vehicleMileage: vehicle.mileage };
}

// ============================================================
// PRODUCTION — Control Center "Maintenance".
// ============================================================

export type MaintenanceWindow = "today" | "7d" | "30d" | "overdue";

export async function listMaintenanceOverviewForProduction(window?: MaintenanceWindow) {
  const reminders = await db.maintenanceReminder.findMany({
    where: { status: { in: ["PENDING", "SCHEDULED", "SENT"] } },
    include: {
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          chicanoVehicleId: true,
          mileage: true,
          customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  const withLevel = reminders.map((r) => ({ ...r, level: computeReminderLevel(r, r.vehicle.mileage) }));

  const windowFiltered = !window
    ? withLevel
    : window === "overdue"
      ? withLevel.filter((r) => r.level === "OVERDUE")
      : withLevel.filter((r) => {
          if (!r.dueAt) return false;
          const days = (r.dueAt.getTime() - Date.now()) / 86_400_000;
          if (window === "today") return days <= 1 && days >= -1;
          if (window === "7d") return days <= 7;
          if (window === "30d") return days <= 30;
          return true;
        });

  const vehiclesWithoutPlan = await db.vehicle.findMany({
    where: { status: "ACTIVE", maintenancePlans: { none: {} } },
    select: { id: true, make: true, model: true, chicanoVehicleId: true },
    take: 50,
  });

  return { reminders: windowFiltered, vehiclesWithoutPlan };
}
