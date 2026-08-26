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
const { assignTechnician, departForAssignment, arriveForAssignment } = await import("@/lib/technicians/service");
const {
  startDiagnostic,
  upsertDiagnosticCheck,
  addFaultCode,
  removeFaultCode,
  completeDiagnostic,
  getDiagnosticForTechnician,
  DiagnosticConflictError,
  DiagnosticNotFoundError,
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

// Reproduit toute la chaîne amont (Phases 3-5) jusqu'au statut ARRIVED, seul
// point d'entrée valide du diagnostic (voir startDiagnostic()).
async function createArrivedAssignment(technicianId = TECH_A) {
  const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
  const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-03", scheduledSlot: "08:00-10:00" });
  const assignment = await assignTechnician(accepted.id, technicianId);
  await departForAssignment(technicianId, assignment.id);
  return arriveForAssignment(technicianId, assignment.id);
}

describe("startDiagnostic", () => {
  it("crée un diagnostic une fois le statut ARRIVED atteint", async () => {
    const assignment = await createArrivedAssignment();
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, { mileageAtVisit: 45000, symptoms: "Voyant moteur" });

    expect(diagnostic.status).toBe("IN_PROGRESS");
    expect(diagnostic.mileageAtVisit).toBe(45000);
  });

  it("refuse de démarrer avant ARRIVED", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-03", scheduledSlot: "08:00-10:00" });
    const assignment = await assignTechnician(accepted.id, TECH_A);

    await expect(startDiagnostic(TECH_A, assignment.id, {})).rejects.toThrow(DiagnosticConflictError);
  });

  it("est idempotent : un second appel retourne le diagnostic déjà démarré", async () => {
    const assignment = await createArrivedAssignment();
    const first = await startDiagnostic(TECH_A, assignment.id, {});
    const second = await startDiagnostic(TECH_A, assignment.id, {});

    expect(second.id).toBe(first.id);
  });
});

describe("checklist et codes défaut", () => {
  it("upsertDiagnosticCheck enregistre puis met à jour un même point de contrôle", async () => {
    const assignment = await createArrivedAssignment();
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});

    await upsertDiagnosticCheck(TECH_A, diagnostic.id, { category: "BRAKING", result: "ANOMALY", observation: "Plaquettes usées" });
    const afterFirst = await getDiagnosticForTechnician(TECH_A, diagnostic.id);
    expect(afterFirst.checks).toHaveLength(1);
    expect(afterFirst.checks[0].result).toBe("ANOMALY");

    await upsertDiagnosticCheck(TECH_A, diagnostic.id, { category: "BRAKING", result: "NORMAL" });
    const afterSecond = await getDiagnosticForTechnician(TECH_A, diagnostic.id);
    expect(afterSecond.checks).toHaveLength(1);
    expect(afterSecond.checks[0].result).toBe("NORMAL");
  });

  it("addFaultCode puis removeFaultCode", async () => {
    const assignment = await createArrivedAssignment();
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});

    const withCode = await addFaultCode(TECH_A, diagnostic.id, { code: "P0300", description: "Ratés d'allumage" });
    expect(withCode.faultCodes).toHaveLength(1);

    const withoutCode = await removeFaultCode(TECH_A, diagnostic.id, withCode.faultCodes[0].id);
    expect(withoutCode.faultCodes).toHaveLength(0);
  });
});

describe("completeDiagnostic", () => {
  it("passe le diagnostic à COMPLETED et clôt l'affectation", async () => {
    const assignment = await createArrivedAssignment();
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});

    const completed = await completeDiagnostic(TECH_A, diagnostic.id, { mileageAtVisit: 45120 });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.mileageAtVisit).toBe(45120);

    const closedAssignment = fakeDb._technicianAssignments.find((a) => a.id === assignment.id);
    expect(closedAssignment?.status).toBe("COMPLETED");
  });

  it("refuse de modifier un diagnostic déjà terminé", async () => {
    const assignment = await createArrivedAssignment();
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});
    await completeDiagnostic(TECH_A, diagnostic.id, {});

    await expect(upsertDiagnosticCheck(TECH_A, diagnostic.id, { category: "ENGINE", result: "NORMAL" })).rejects.toThrow(
      DiagnosticConflictError
    );
    await expect(completeDiagnostic(TECH_A, diagnostic.id, {})).rejects.toThrow(DiagnosticConflictError);
  });
});

describe("ownership", () => {
  it("un technicien ne peut pas voir ni modifier le diagnostic d'un autre (404, jamais 403)", async () => {
    const assignment = await createArrivedAssignment(TECH_A);
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});

    await expect(getDiagnosticForTechnician(TECH_B, diagnostic.id)).rejects.toThrow(DiagnosticNotFoundError);
    await expect(upsertDiagnosticCheck(TECH_B, diagnostic.id, { category: "ENGINE", result: "NORMAL" })).rejects.toThrow(
      DiagnosticNotFoundError
    );
  });
});
