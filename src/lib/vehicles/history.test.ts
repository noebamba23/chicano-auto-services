import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "@/lib/service-requests/test-utils/fake-db";

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/service-requests/test-utils/fake-db");
  return { db: createFakeDb() };
});

const { db } = await import("@/lib/db");
const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;

const { getVehicleHistory, getVehicleHistoryForCustomer } = await import("./history");
const { VehicleNotFoundError } = await import("./service");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";

beforeEach(() => {
  fakeDb._reset();
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A } as never);
});

describe("getVehicleHistory — agrégation", () => {
  it("aucune source : historique vide, jamais inventé", async () => {
    const result = await getVehicleHistory(VEHICLE_A);
    expect(result.events).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("agrège ServiceRequest, DiagnosticReport publié et WorkOrder terminé, triés par date décroissante", async () => {
    await fakeDb.serviceRequest.create({
      data: { vehicleId: VEHICLE_A, customerId: CUSTOMER_A, referenceNumber: "CHC-SR-000001", category: "REPAIR", status: "ACCEPTED" },
    });

    const diagnostic = await fakeDb.diagnostic.create({
      data: { vehicleId: VEHICLE_A, appointmentId: "apt-1", technicianId: "tech-1", status: "COMPLETED" },
    });
    await fakeDb.diagnosticReport.create({
      data: {
        diagnosticId: diagnostic.id,
        reportNumber: "CHC-DR-000001",
        severity: "URGENT",
        publishedAt: new Date("2026-08-27"),
      },
    });

    const workOrder = await fakeDb.workOrder.create({
      data: {
        workOrderNumber: "CHC-WO-000001",
        customerId: CUSTOMER_A,
        vehicleId: VEHICLE_A,
        serviceRequestId: "sr-1",
        quoteId: "quote-1",
        acceptedQuoteVersionNumber: 1,
        status: "COMPLETED",
        qualityCheckedAt: new Date("2026-08-28"),
      },
    });
    await fakeDb.workOrderItem.create({
      data: { workOrderId: workOrder.id, type: "PART", description: "Remplacement batterie" },
    });

    const result = await getVehicleHistory(VEHICLE_A);
    expect(result.events.length).toBeGreaterThanOrEqual(3);

    const categories = result.events.map((e) => e.category);
    expect(categories).toContain("DIAGNOSTIC");
    expect(categories).toContain("REPAIR");
    expect(categories).toContain("OTHER");

    // Trié décroissant : le WorkOrder (28 août) doit précéder le rapport (27 août).
    const woIndex = result.events.findIndex((e) => e.category === "REPAIR");
    const drIndex = result.events.findIndex((e) => e.category === "DIAGNOSTIC");
    expect(woIndex).toBeLessThan(drIndex);
  });

  it("un WorkOrder avec une ligne rattachée à un entretien apparaît en catégorie MAINTENANCE, pas REPAIR", async () => {
    const workOrder = await fakeDb.workOrder.create({
      data: {
        workOrderNumber: "CHC-WO-000002",
        customerId: CUSTOMER_A,
        vehicleId: VEHICLE_A,
        serviceRequestId: "sr-2",
        quoteId: "quote-2",
        acceptedQuoteVersionNumber: 1,
        status: "COMPLETED",
        qualityCheckedAt: new Date(),
      },
    });
    await fakeDb.workOrderItem.create({
      data: { workOrderId: workOrder.id, type: "SERVICE", description: "Vidange", maintenanceType: "OIL_CHANGE" },
    });

    const result = await getVehicleHistory(VEHICLE_A);
    expect(result.events[0].category).toBe("MAINTENANCE");
  });

  it("un WorkOrder non terminé (IN_PROGRESS) n'apparaît pas dans l'historique", async () => {
    const workOrder = await fakeDb.workOrder.create({
      data: {
        workOrderNumber: "CHC-WO-000003",
        customerId: CUSTOMER_A,
        vehicleId: VEHICLE_A,
        serviceRequestId: "sr-3",
        quoteId: "quote-3",
        acceptedQuoteVersionNumber: 1,
        status: "IN_PROGRESS",
      },
    });
    await fakeDb.workOrderItem.create({ data: { workOrderId: workOrder.id, type: "PART", description: "Test" } });

    const result = await getVehicleHistory(VEHICLE_A);
    expect(result.events).toHaveLength(0);
  });

  it("un rapport de diagnostic non publié (brouillon) n'apparaît jamais", async () => {
    const diagnostic = await fakeDb.diagnostic.create({
      data: { vehicleId: VEHICLE_A, appointmentId: "apt-2", technicianId: "tech-1", status: "COMPLETED" },
    });
    await fakeDb.diagnosticReport.create({
      data: { diagnosticId: diagnostic.id, reportNumber: "CHC-DR-000002", severity: "NORMAL", publishedAt: null },
    });

    const result = await getVehicleHistory(VEHICLE_A);
    expect(result.events).toHaveLength(0);
  });

  it("filtre par catégorie", async () => {
    const workOrder = await fakeDb.workOrder.create({
      data: {
        workOrderNumber: "CHC-WO-000004",
        customerId: CUSTOMER_A,
        vehicleId: VEHICLE_A,
        serviceRequestId: "sr-4",
        quoteId: "quote-4",
        acceptedQuoteVersionNumber: 1,
        status: "COMPLETED",
      },
    });
    await fakeDb.workOrderItem.create({ data: { workOrderId: workOrder.id, type: "PART", description: "Test" } });
    await fakeDb.serviceRequest.create({
      data: { vehicleId: VEHICLE_A, customerId: CUSTOMER_A, referenceNumber: "CHC-SR-000005", category: "REPAIR", status: "ACCEPTED" },
    });

    const result = await getVehicleHistory(VEHICLE_A, { category: "REPAIR" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].category).toBe("REPAIR");
  });

  it("pagination : limite le nombre d'événements retournés", async () => {
    for (let i = 0; i < 5; i++) {
      await fakeDb.serviceRequest.create({
        data: { vehicleId: VEHICLE_A, customerId: CUSTOMER_A, referenceNumber: `CHC-SR-00000${i}`, category: "REPAIR", status: "ACCEPTED" },
      });
    }

    const page = await getVehicleHistory(VEHICLE_A, { limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(page.total).toBe(5);
    expect(page.hasMore).toBe(true);
  });
});

describe("getVehicleHistoryForCustomer — ownership", () => {
  it("un client ne peut pas voir l'historique du véhicule d'un autre client (404)", async () => {
    fakeDb._seedCustomer({ id: CUSTOMER_B, userId: "user-b" });
    await expect(getVehicleHistoryForCustomer(CUSTOMER_B, VEHICLE_A)).rejects.toThrow(VehicleNotFoundError);
  });

  it("le propriétaire voit son historique", async () => {
    await expect(getVehicleHistoryForCustomer(CUSTOMER_A, VEHICLE_A)).resolves.toEqual(
      expect.objectContaining({ events: expect.any(Array) })
    );
  });
});
