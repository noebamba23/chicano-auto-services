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

const { createServiceRequest, acceptServiceRequest } = await import("@/lib/service-requests/service");
const {
  assignTechnician,
  listTechnicians,
  departForAssignment,
  arriveForAssignment,
  getAssignmentForTechnician,
  TechnicianConflictError,
  AssignmentNotFoundError,
} = await import("./service");

const CUSTOMER_A = "customer-a";
const VEHICLE_A = "vehicle-a";
const TECH_A = "tech-a";
const TECH_B = "tech-b";

const VALID_INPUT = {
  vehicleId: VEHICLE_A,
  category: "DIAGNOSTIC" as const,
  description: "Le véhicule ne démarre plus.",
  interventionType: "AT_GARAGE" as const,
  isUrgent: false,
} as Parameters<typeof createServiceRequest>[1];

beforeEach(() => {
  fakeDb._reset();
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A });
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedTechnician({ id: TECH_A, user: { firstName: "DEMO", lastName: "TECHNICIEN A" } });
  fakeDb._seedTechnician({ id: TECH_B, user: { firstName: "DEMO", lastName: "TECHNICIEN B" } });
});

async function createAcceptedRequest(date: string, slot: string) {
  const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
  return acceptServiceRequest(request.id, { scheduledDate: date, scheduledSlot: slot });
}

describe("listTechnicians", () => {
  it("retourne les techniciens seedés", async () => {
    const technicians = await listTechnicians();
    expect(technicians).toHaveLength(2);
  });
});

describe("assignTechnician", () => {
  it("affecte un technicien à un rendez-vous et met à jour son statut", async () => {
    const result = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    const assignment = await assignTechnician(result.id, TECH_A);
    expect(assignment.technicianId).toBe(TECH_A);
    expect(assignment.status).toBe("ASSIGNED");
  });

  it("refuse si la demande n'a pas encore de rendez-vous", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    await expect(assignTechnician(request.id, TECH_A)).rejects.toThrow(TechnicianConflictError);
  });

  it("empêche la double réservation du même technicien sur le même créneau", async () => {
    const first = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    await assignTechnician(first.id, TECH_A);

    const second = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    await expect(assignTechnician(second.id, TECH_A)).rejects.toThrow(TechnicianConflictError);
  });

  it("autorise un autre technicien sur le même créneau", async () => {
    const first = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    await assignTechnician(first.id, TECH_A);

    const second = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    const assignment = await assignTechnician(second.id, TECH_B);
    expect(assignment.technicianId).toBe(TECH_B);
  });

  it("autorise le même technicien sur un créneau différent", async () => {
    const first = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    await assignTechnician(first.id, TECH_A);

    const second = await createAcceptedRequest("2026-09-01", "10:00-12:00");
    const assignment = await assignTechnician(second.id, TECH_A);
    expect(assignment.technicianId).toBe(TECH_A);
  });

  it("réaffecter marque l'ancienne affectation REASSIGNED plutôt que de la supprimer", async () => {
    const result = await createAcceptedRequest("2026-09-01", "08:00-10:00");
    await assignTechnician(result.id, TECH_A);
    await assignTechnician(result.id, TECH_B);

    const reassigned = fakeDb._technicianAssignments.filter((a) => a.technicianId === TECH_A);
    expect(reassigned).toHaveLength(1);
    expect(reassigned[0].status).toBe("REASSIGNED");
  });
});

describe("Espace technicien (Phase 5) — départ et arrivée", () => {
  it("ASSIGNED → EN_ROUTE via departForAssignment", async () => {
    const result = await createAcceptedRequest("2026-09-02", "08:00-10:00");
    const assignment = await assignTechnician(result.id, TECH_A);

    const updated = await departForAssignment(TECH_A, assignment.id);
    expect(updated.status).toBe("EN_ROUTE");
    expect(updated.departedAt).not.toBeNull();
  });

  it("refuse de partir deux fois (ASSIGNED requis)", async () => {
    const result = await createAcceptedRequest("2026-09-02", "08:00-10:00");
    const assignment = await assignTechnician(result.id, TECH_A);
    await departForAssignment(TECH_A, assignment.id);

    await expect(departForAssignment(TECH_A, assignment.id)).rejects.toThrow(TechnicianConflictError);
  });

  it("refuse d'arriver avant d'être parti (EN_ROUTE requis)", async () => {
    const result = await createAcceptedRequest("2026-09-02", "08:00-10:00");
    const assignment = await assignTechnician(result.id, TECH_A);

    await expect(arriveForAssignment(TECH_A, assignment.id)).rejects.toThrow(TechnicianConflictError);
  });

  it("EN_ROUTE → ARRIVED via arriveForAssignment après le départ", async () => {
    const result = await createAcceptedRequest("2026-09-02", "08:00-10:00");
    const assignment = await assignTechnician(result.id, TECH_A);
    await departForAssignment(TECH_A, assignment.id);

    const updated = await arriveForAssignment(TECH_A, assignment.id);
    expect(updated.status).toBe("ARRIVED");
    expect(updated.arrivedAt).not.toBeNull();
  });

  it("un technicien ne peut ni voir ni agir sur l'affectation d'un autre (404, jamais 403)", async () => {
    const result = await createAcceptedRequest("2026-09-02", "08:00-10:00");
    const assignment = await assignTechnician(result.id, TECH_A);

    await expect(getAssignmentForTechnician(TECH_B, assignment.id)).rejects.toThrow(AssignmentNotFoundError);
    await expect(departForAssignment(TECH_B, assignment.id)).rejects.toThrow(AssignmentNotFoundError);
  });
});
