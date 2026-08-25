import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "./test-utils/fake-db";

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("./test-utils/fake-db");
  return { db: createFakeDb() };
});

vi.mock("@/lib/notifications/service", () => ({
  sendNotification: vi.fn().mockResolvedValue(null),
}));

const { db } = await import("@/lib/db");
const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;

const {
  createServiceRequest,
  cancelServiceRequest,
  getServiceRequestForCustomer,
  acceptServiceRequest,
  rejectServiceRequest,
  requestReschedule,
  markUnderReview,
  completeServiceRequest,
  ServiceRequestNotFoundError,
  ServiceRequestConflictError,
} = await import("./service");

const { VehicleConflictError } = await import("@/lib/vehicles/service");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";
const VEHICLE_B = "vehicle-b";

const VALID_INPUT = {
  vehicleId: VEHICLE_A,
  category: "DIAGNOSTIC" as const,
  description: "Le véhicule ne démarre plus.",
  interventionType: "AT_GARAGE" as const,
  isUrgent: false,
  urgencyDescription: "",
  preferredSlot: null,
} as Parameters<typeof createServiceRequest>[1];

beforeEach(() => {
  fakeDb._reset();
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A });
  fakeDb._seedVehicle({ id: VEHICLE_B, customerId: CUSTOMER_B });
});

describe("createServiceRequest", () => {
  it("génère une référence CHC-SR-000001 et associe le bon véhicule", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    expect(request.referenceNumber).toBe("CHC-SR-000001");
    expect(request.status).toBe("SUBMITTED");
    expect(request.vehicleId).toBe(VEHICLE_A);
  });

  it("refuse un véhicule appartenant à un autre client", async () => {
    await expect(
      createServiceRequest(CUSTOMER_A, { ...VALID_INPUT, vehicleId: VEHICLE_B })
    ).rejects.toThrow();
  });

  it("refuse un véhicule archivé", async () => {
    fakeDb._reset();
    fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, status: "ARCHIVED" });
    await expect(createServiceRequest(CUSTOMER_A, VALID_INPUT)).rejects.toThrow(VehicleConflictError);
  });

  it("crée une RequestLocation quand l'intervention est mobile avec des coordonnées", async () => {
    const request = await createServiceRequest(CUSTOMER_A, {
      ...VALID_INPUT,
      interventionType: "MOBILE",
      location: { latitude: 12.65, longitude: -8.0, locationSource: "GPS" },
    } as never);
    expect(request.location).not.toBeNull();
    expect(request.location?.latitude).toBe(12.65);
  });
});

describe("ownership", () => {
  it("getServiceRequestForCustomer lève une erreur pour la demande d'un autre client", async () => {
    const request = await createServiceRequest(CUSTOMER_B, { ...VALID_INPUT, vehicleId: VEHICLE_B });
    await expect(getServiceRequestForCustomer(CUSTOMER_A, request.id)).rejects.toThrow(
      ServiceRequestNotFoundError
    );
  });

  it("cancelServiceRequest refuse d'annuler la demande d'un autre client", async () => {
    const request = await createServiceRequest(CUSTOMER_B, { ...VALID_INPUT, vehicleId: VEHICLE_B });
    await expect(cancelServiceRequest(CUSTOMER_A, request.id)).rejects.toThrow(ServiceRequestNotFoundError);
  });
});

describe("annulation", () => {
  it("SUBMITTED → CANCELLED autorisé", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const cancelled = await cancelServiceRequest(CUSTOMER_A, request.id);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("COMPLETED → CANCELLED refusé", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await fakeDb.serviceRequest.update({ where: { id: request.id }, data: { status: "COMPLETED" } });
    await expect(cancelServiceRequest(CUSTOMER_A, request.id)).rejects.toThrow(ServiceRequestConflictError);
  });
});

describe("production — acceptation / refus / replanification", () => {
  it("accepte une demande et crée un Appointment lié", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const result = await acceptServiceRequest(request.id, {
      scheduledDate: "2026-09-01",
      scheduledSlot: "08:00-10:00",
    });
    expect(result.status).toBe("ACCEPTED");
    expect(result.appointment).not.toBeNull();
    expect(result.appointment?.scheduledSlot).toBe("08:00-10:00");
  });

  it("refuse d'accepter une demande déjà refusée", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await rejectServiceRequest(request.id, "test");
    await expect(
      acceptServiceRequest(request.id, { scheduledDate: "2026-09-01", scheduledSlot: "08:00-10:00" })
    ).rejects.toThrow(ServiceRequestConflictError);
  });

  it("rejette une demande", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const result = await rejectServiceRequest(request.id, "Pas disponible");
    expect(result.status).toBe("REJECTED");
  });

  it("propose un autre créneau (RESCHEDULE_REQUESTED)", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const result = await requestReschedule(request.id, { scheduledDate: "2026-09-05", scheduledSlot: "14:00-16:00" });
    expect(result.status).toBe("RESCHEDULE_REQUESTED");
    expect(result.appointment?.scheduledSlot).toBe("14:00-16:00");
  });
});

describe("relation ServiceRequest → Appointment", () => {
  it("l'Appointment créé référence bien la ServiceRequest d'origine", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const result = await acceptServiceRequest(request.id, {
      scheduledDate: "2026-09-01",
      scheduledSlot: "08:00-10:00",
    });
    expect(result.appointment?.serviceRequestId).toBe(request.id);
    expect(result.appointment?.customerId).toBe(CUSTOMER_A);
  });
});

describe("Kanban Phase 4 — mise en examen et clôture", () => {
  it("SUBMITTED → UNDER_REVIEW autorisé", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const result = await markUnderReview(request.id);
    expect(result.status).toBe("UNDER_REVIEW");
  });

  it("UNDER_REVIEW → ACCEPTED reste possible après mise en examen", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await markUnderReview(request.id);
    const result = await acceptServiceRequest(request.id, {
      scheduledDate: "2026-09-01",
      scheduledSlot: "08:00-10:00",
    });
    expect(result.status).toBe("ACCEPTED");
  });

  it("ACCEPTED → COMPLETED clôture la demande et l'Appointment lié", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await acceptServiceRequest(request.id, { scheduledDate: "2026-09-01", scheduledSlot: "08:00-10:00" });
    const result = await completeServiceRequest(request.id);
    expect(result.status).toBe("COMPLETED");

    const reloaded = await getServiceRequestForCustomer(CUSTOMER_A, request.id);
    expect(reloaded.appointment?.status).toBe("COMPLETED");
  });

  it("refuse de clôturer une demande qui n'a pas été acceptée", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await expect(completeServiceRequest(request.id)).rejects.toThrow(ServiceRequestConflictError);
  });

  it("refuse de mettre en examen une demande déjà refusée", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await rejectServiceRequest(request.id, "test");
    await expect(markUnderReview(request.id)).rejects.toThrow(ServiceRequestConflictError);
  });
});
