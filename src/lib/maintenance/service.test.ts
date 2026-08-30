import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "@/lib/service-requests/test-utils/fake-db";

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/service-requests/test-utils/fake-db");
  return { db: createFakeDb() };
});

vi.mock("@/lib/notifications/service", () => ({
  sendNotification: vi.fn().mockResolvedValue(null),
}));

const { db } = await import("@/lib/db");
const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;
const { sendNotification } = await import("@/lib/notifications/service");

const {
  createMaintenancePlan,
  updateMaintenancePlan,
  createMaintenanceReminder,
  cancelMaintenanceReminder,
  computeReminderLevel,
  checkAndNotifyReminders,
  completeMaintenanceFromWorkOrder,
  createServiceRequestFromReminder,
  getVehicleMaintenanceForCustomer,
  listMaintenanceOverviewForProduction,
  MaintenanceConflictError,
  MaintenanceReminderNotFoundError,
} = await import("./service");
const { VehicleNotFoundError } = await import("@/lib/vehicles/service");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";
const VEHICLE_B = "vehicle-b";

beforeEach(() => {
  fakeDb._reset();
  vi.clearAllMocks();
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedCustomer({ id: CUSTOMER_B, userId: "user-b" });
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, make: "Toyota", model: "Hilux", mileage: 100_000 } as never);
  fakeDb._seedVehicle({ id: VEHICLE_B, customerId: CUSTOMER_B, make: "Toyota", model: "Corolla" } as never);
});

describe("computeReminderLevel", () => {
  it("OVERDUE si la date est dépassée", () => {
    const level = computeReminderLevel({ dueAt: new Date(Date.now() - 86_400_000), dueMileage: null }, null);
    expect(level).toBe("OVERDUE");
  });

  it("DUE si l'échéance est proche (moins de 7 jours)", () => {
    const level = computeReminderLevel({ dueAt: new Date(Date.now() + 3 * 86_400_000), dueMileage: null }, null);
    expect(level).toBe("DUE");
  });

  it("UPCOMING si l'échéance est dans le mois", () => {
    const level = computeReminderLevel({ dueAt: new Date(Date.now() + 20 * 86_400_000), dueMileage: null }, null);
    expect(level).toBe("UPCOMING");
  });

  it("null si aucun seuil atteint", () => {
    const level = computeReminderLevel({ dueAt: new Date(Date.now() + 90 * 86_400_000), dueMileage: null }, null);
    expect(level).toBeNull();
  });

  it("déclenché par le kilométrage même sans date", () => {
    const level = computeReminderLevel({ dueAt: null, dueMileage: 100_050 }, 100_000);
    expect(level).toBe("DUE");
  });

  it("date + kilométrage : le premier seuil atteint (le plus urgent) gagne", () => {
    // Date encore loin (UPCOMING) mais kilométrage dépassé (OVERDUE) → OVERDUE.
    const level = computeReminderLevel(
      { dueAt: new Date(Date.now() + 20 * 86_400_000), dueMileage: 99_000 },
      100_000
    );
    expect(level).toBe("OVERDUE");
  });
});

describe("MaintenancePlan", () => {
  it("création avec au moins un intervalle", async () => {
    const plan = await createMaintenancePlan(VEHICLE_A, { type: "OIL_CHANGE", intervalKm: 10_000, intervalMonths: 6 });
    expect(plan.type).toBe("OIL_CHANGE");
    expect(plan.isActive).toBe(true);
  });

  it("refuse un plan sans aucun intervalle", async () => {
    await expect(createMaintenancePlan(VEHICLE_A, { type: "OIL_CHANGE" })).rejects.toThrow(MaintenanceConflictError);
  });

  it("refuse un plan pour un véhicule inexistant", async () => {
    await expect(createMaintenancePlan("unknown", { type: "OIL_CHANGE", intervalKm: 5000 })).rejects.toThrow(
      VehicleNotFoundError
    );
  });

  it("désactivation d'un plan", async () => {
    const plan = await createMaintenancePlan(VEHICLE_A, { type: "OIL_CHANGE", intervalKm: 10_000 });
    const updated = await updateMaintenancePlan(plan.id, { isActive: false });
    expect(updated.isActive).toBe(false);
  });
});

describe("MaintenanceReminder", () => {
  it("création par date", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueAt: "2026-12-01" });
    expect(reminder.dueAt).not.toBeNull();
    expect(reminder.status).toBe("SCHEDULED");
  });

  it("création par kilométrage", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 110_000 });
    expect(reminder.dueMileage).toBe(110_000);
  });

  it("création par date ET kilométrage", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, {
      type: "OIL_CHANGE",
      dueAt: "2026-12-01",
      dueMileage: 110_000,
    });
    expect(reminder.dueAt).not.toBeNull();
    expect(reminder.dueMileage).toBe(110_000);
  });

  it("refuse un rappel sans aucune échéance", async () => {
    await expect(createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE" })).rejects.toThrow(MaintenanceConflictError);
  });

  it("annulation", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 110_000 });
    const cancelled = await cancelMaintenanceReminder(reminder.id, "Client a vendu le véhicule");
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("refuse d'annuler un rappel déjà clos", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 110_000 });
    await cancelMaintenanceReminder(reminder.id);
    await expect(cancelMaintenanceReminder(reminder.id)).rejects.toThrow(MaintenanceConflictError);
  });
});

describe("checkAndNotifyReminders — notifications progressives", () => {
  it("envoie MAINTENANCE_DUE et ne le renvoie pas au second passage (anti-spam)", async () => {
    await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });

    const first = await checkAndNotifyReminders();
    expect(first.notified).toBe(1);
    expect(sendNotification).toHaveBeenCalledWith("user-a", "MAINTENANCE_DUE", expect.any(Object));

    vi.clearAllMocks();
    const second = await checkAndNotifyReminders();
    expect(second.notified).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("progresse de UPCOMING à OVERDUE quand le niveau change", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, {
      type: "OIL_CHANGE",
      dueAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    });
    await checkAndNotifyReminders();
    vi.clearAllMocks();

    await fakeDb.maintenanceReminder.update({ where: { id: reminder.id }, data: { dueAt: new Date(Date.now() - 86_400_000) } });
    const result = await checkAndNotifyReminders();
    expect(result.notified).toBe(1);
    expect(sendNotification).toHaveBeenCalledWith("user-a", "MAINTENANCE_OVERDUE", expect.any(Object));
  });
});

describe("entretien terminé → historique + prochaine échéance", () => {
  async function seedWorkOrderWithMaintenance(status: string) {
    const wo = await fakeDb.workOrder.create({
      data: {
        workOrderNumber: "CHC-WO-000001",
        customerId: CUSTOMER_A,
        vehicleId: VEHICLE_A,
        serviceRequestId: "sr-1",
        quoteId: "quote-1",
        acceptedQuoteVersionNumber: 1,
        status,
        qualityCheckedAt: new Date(),
      },
    });
    await fakeDb.workOrderItem.create({
      data: { workOrderId: wo.id, type: "SERVICE", description: "Vidange", maintenanceType: "OIL_CHANGE" },
    });
    return wo;
  }

  it("clôt le rappel correspondant et calcule la prochaine échéance depuis le plan", async () => {
    const plan = await createMaintenancePlan(VEHICLE_A, { type: "OIL_CHANGE", intervalKm: 10_000, intervalMonths: 6 });
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 100_000, planId: plan.id });

    const wo = await seedWorkOrderWithMaintenance("COMPLETED");
    await completeMaintenanceFromWorkOrder(wo.id);

    const closed = (await fakeDb.maintenanceReminder.findUnique({ where: { id: reminder.id } })) as Record<string, unknown>;
    expect(closed.status).toBe("COMPLETED");
    expect(closed.completedByWorkOrderId).toBe(wo.id);

    const updatedPlan = (await fakeDb.maintenancePlan.findUnique({ where: { id: plan.id } })) as Record<string, unknown>;
    expect(updatedPlan.lastDoneMileage).toBe(100_000);

    const nextReminders = (await fakeDb.maintenanceReminder.findMany({
      where: { vehicleId: VEHICLE_A, status: "SCHEDULED" },
    })) as Record<string, unknown>[];
    expect(nextReminders).toHaveLength(1);
    expect(nextReminders[0].dueMileage).toBe(110_000);
  });

  it("n'affecte rien si le WorkOrder ne comporte aucune ligne rattachée à un entretien", async () => {
    const wo = await fakeDb.workOrder.create({
      data: {
        workOrderNumber: "CHC-WO-000002",
        customerId: CUSTOMER_A,
        vehicleId: VEHICLE_A,
        serviceRequestId: "sr-2",
        quoteId: "quote-2",
        acceptedQuoteVersionNumber: 1,
        status: "COMPLETED",
      },
    });
    await fakeDb.workOrderItem.create({ data: { workOrderId: wo.id, type: "PART", description: "Amortisseur" } });

    await expect(completeMaintenanceFromWorkOrder(wo.id)).resolves.not.toThrow();
    const reminders = await fakeDb.maintenanceReminder.findMany({ where: { vehicleId: VEHICLE_A } });
    expect(reminders).toHaveLength(0);
  });
});

describe("rappel → ServiceRequest", () => {
  it("crée une ServiceRequest pré-remplie sans ressaisie du véhicule", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 110_000 });
    const request = await createServiceRequestFromReminder(CUSTOMER_A, reminder.id);

    expect(request.vehicleId).toBe(VEHICLE_A);
    expect(request.category).toBe("MAINTENANCE");
    expect(request.status).toBe("SUBMITTED");
  });

  it("un client ne peut pas déclencher une ServiceRequest depuis le rappel d'un autre client (404)", async () => {
    const reminder = await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 110_000 });
    await expect(createServiceRequestFromReminder(CUSTOMER_B, reminder.id)).rejects.toThrow(MaintenanceReminderNotFoundError);
  });
});

describe("espace client — ownership", () => {
  it("le client voit ses plans/rappels", async () => {
    await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 110_000 });
    const result = await getVehicleMaintenanceForCustomer(CUSTOMER_A, VEHICLE_A);
    expect(result.reminders).toHaveLength(1);
  });

  it("client A ne peut pas voir l'entretien du véhicule de client B (404)", async () => {
    await expect(getVehicleMaintenanceForCustomer(CUSTOMER_A, VEHICLE_B)).rejects.toThrow(VehicleNotFoundError);
  });
});

describe("production — vue d'ensemble", () => {
  it("liste les rappels actifs et les véhicules sans plan", async () => {
    await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueMileage: 100_050 });
    const overview = await listMaintenanceOverviewForProduction();

    expect(overview.reminders).toHaveLength(1);
    expect(overview.vehiclesWithoutPlan.some((v: { id: string }) => v.id === VEHICLE_A)).toBe(true);
  });

  it("filtre 'overdue' ne retourne que les rappels réellement en retard", async () => {
    await createMaintenanceReminder(VEHICLE_A, { type: "OIL_CHANGE", dueAt: new Date(Date.now() - 86_400_000).toISOString() });
    await createMaintenanceReminder(VEHICLE_A, { type: "BRAKES", dueAt: new Date(Date.now() + 60 * 86_400_000).toISOString() });

    const overview = await listMaintenanceOverviewForProduction("overdue");
    expect(overview.reminders).toHaveLength(1);
    expect(overview.reminders[0].type).toBe("OIL_CHANGE");
  });
});
