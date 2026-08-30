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
const { startDiagnostic, completeDiagnostic } = await import("@/lib/diagnostics/service");
const { createQuote, sendQuoteToClient, acceptQuote } = await import("@/lib/quotes/service");
const {
  getWorkOrderForProduction,
  getWorkOrderForCustomer,
  getWorkOrderForTechnician,
  listWorkOrdersForCustomer,
  scheduleWorkOrder,
  assignTechnicianToWorkOrder,
  startWorkOrder,
  pauseWorkOrder,
  resumeWorkOrder,
  markWaitingParts,
  sendToQualityCheck,
  passQualityCheck,
  failQualityCheck,
  cancelWorkOrder,
  requestAdditionalWork,
  technicianStartWorkOrder,
  technicianReportMissingPart,
  updateWorkOrderPartStatus,
  WorkOrderConflictError,
  WorkOrderNotFoundError,
} = await import("./service");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";
const TECH_A = "tech-a";
const TECH_B = "tech-b";

const VALID_INPUT = {
  vehicleId: VEHICLE_A,
  category: "REPAIR" as const,
  description: "Freins à changer.",
  interventionType: "AT_GARAGE" as const,
  isUrgent: false,
} as Parameters<typeof createServiceRequest>[1];

const ITEMS = [{ label: "Plaquettes de frein", quantity: 2, unitPrice: 15000 }];

beforeEach(() => {
  fakeDb._reset();
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, licensePlate: "AB123CD" });
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedTechnician({ id: TECH_A, user: { firstName: "DEMO", lastName: "TECHNICIEN A" } });
  fakeDb._seedTechnician({ id: TECH_B, user: { firstName: "DEMO", lastName: "TECHNICIEN B" } });
});

// Chaîne complète jusqu'au devis accepté — même point de départ que
// quotes/service.test.ts (createCompletedDiagnostic), ici on va jusqu'à
// l'acceptation pour déclencher automatiquement le WorkOrder.
async function createAcceptedQuote() {
  const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
  const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-10", scheduledSlot: "08:00-10:00" });
  const assignment = await assignTechnician(accepted.id, TECH_A);
  await departForAssignment(TECH_A, assignment.id);
  await arriveForAssignment(TECH_A, assignment.id);
  const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});
  await completeDiagnostic(TECH_A, diagnostic.id, {});
  const quote = await createQuote(diagnostic.id, { items: ITEMS, laborAmount: 5000 });
  await sendQuoteToClient(quote.id);
  return acceptQuote(CUSTOMER_A, quote.id);
}

describe("création automatique depuis un devis accepté", () => {
  it("QUOTE ACCEPTED → WORK ORDER CREATED, référence CHC-WO-000001", async () => {
    await createAcceptedQuote();

    const list = await listWorkOrdersForCustomer(CUSTOMER_A);
    expect(list).toHaveLength(1);
    expect(list[0].workOrderNumber).toMatch(/^CHC-WO-\d{6}$/);
  });

  it("récupère automatiquement client/véhicule/ServiceRequest/technicien/version acceptée, sans ressaisie", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    expect(wo.customerId).toBe(CUSTOMER_A);
    expect(wo.vehicleId).toBe(VEHICLE_A);
    expect(wo.technicianId).toBe(TECH_A);
    expect(wo.acceptedQuoteVersionNumber).toBe(1);
    expect(wo.serviceRequest).not.toBeNull();
  });

  it("passe directement à SCHEDULED quand le rendez-vous a déjà une date planifiée", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);
    expect(wo.status).toBe("SCHEDULED");
    expect(wo.scheduledDate).not.toBeNull();
  });

  it("reprend les lignes du devis accepté comme travaux (jamais de ressaisie libre)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    const partItem = wo.items.find((i: { type: string }) => i.type === "SERVICE" || i.type === "PART");
    const laborItem = wo.items.find((i: { type: string }) => i.type === "LABOR");
    expect(partItem).toBeDefined();
    expect(partItem?.sourceQuoteItemId).not.toBeNull();
    expect(laborItem).toBeDefined();
    expect(Number(laborItem?.unitPrice)).toBe(5000);
  });

  it("est idempotent : un second appel ne duplique pas le Work Order (contrainte 1 devis → 1 ordre)", async () => {
    const accepted = await createAcceptedQuote();
    const before = await listWorkOrdersForCustomer(CUSTOMER_A);

    const { createWorkOrderFromQuote } = await import("./service");
    await createWorkOrderFromQuote(accepted.id);

    const after = await listWorkOrdersForCustomer(CUSTOMER_A);
    expect(after).toHaveLength(before.length);
    expect(after[0].id).toBe(before[0].id);
  });
});

describe("ownership", () => {
  it("un autre client ne peut pas voir ce Work Order (404, jamais 403)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await expect(getWorkOrderForCustomer(CUSTOMER_B, wo.id)).rejects.toThrow(WorkOrderNotFoundError);
  });

  it("un technicien non affecté ne peut pas voir ce Work Order (404)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await expect(getWorkOrderForTechnician(TECH_B, wo.id)).rejects.toThrow(WorkOrderNotFoundError);
    await expect(getWorkOrderForTechnician(TECH_A, wo.id)).resolves.toBeTruthy();
  });

  it("un technicien affecté à un autre Work Order ne peut pas le démarrer (404)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await expect(technicianStartWorkOrder(TECH_B, wo.id)).rejects.toThrow(WorkOrderNotFoundError);
  });
});

describe("transitions de statut", () => {
  it("SCHEDULED → IN_PROGRESS → QUALITY_CHECK → COMPLETED (parcours nominal)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await startWorkOrder(wo.id);
    await sendToQualityCheck(wo.id);
    const completed = await passQualityCheck(wo.id, "admin-1", { notes: "RAS", testDrivePerformed: true });

    expect(completed.status).toBe("COMPLETED");
    expect(completed.qualityCheckPassed).toBe(true);
    expect(completed.qualityCheckedAt).not.toBeNull();
  });

  it("IN_PROGRESS → WAITING_PARTS → IN_PROGRESS (branche pièces)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await startWorkOrder(wo.id);
    const waiting = await markWaitingParts(wo.id);
    expect(waiting.status).toBe("WAITING_PARTS");

    const resumed = await resumeWorkOrder(wo.id);
    expect(resumed.status).toBe("IN_PROGRESS");
  });

  it("IN_PROGRESS → ON_HOLD → IN_PROGRESS (pause)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await startWorkOrder(wo.id);
    const paused = await pauseWorkOrder(wo.id);
    expect(paused.status).toBe("ON_HOLD");

    const resumed = await resumeWorkOrder(wo.id);
    expect(resumed.status).toBe("IN_PROGRESS");
  });

  it("contrôle qualité échoué renvoie en IN_PROGRESS, jamais COMPLETED", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await startWorkOrder(wo.id);
    await sendToQualityCheck(wo.id);
    const failed = await failQualityCheck(wo.id, "admin-1", "Bruit persistant au freinage");

    expect(failed.status).toBe("IN_PROGRESS");
    expect(failed.qualityCheckPassed).toBe(false);
  });

  it("refuse de passer à COMPLETED sans être passé par QUALITY_CHECK", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await startWorkOrder(wo.id);
    await expect(passQualityCheck(wo.id, "admin-1", {})).rejects.toThrow(WorkOrderConflictError);
  });

  it("READY/SCHEDULED → CANCELLED autorisé", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    const cancelled = await cancelWorkOrder(wo.id, "Client indisponible");
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("aucune transition possible depuis COMPLETED (statut terminal)", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await startWorkOrder(wo.id);
    await sendToQualityCheck(wo.id);
    await passQualityCheck(wo.id, "admin-1", {});

    await expect(startWorkOrder(wo.id)).rejects.toThrow(WorkOrderConflictError);
    await expect(cancelWorkOrder(wo.id)).rejects.toThrow(WorkOrderConflictError);
  });
});

describe("planification et affectation", () => {
  it("scheduleWorkOrder met à jour la date planifiée", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    const scheduled = await scheduleWorkOrder(wo.id, { scheduledDate: "2026-09-15" });
    expect(scheduled.status).toBe("SCHEDULED");
    expect(scheduled.scheduledDate).not.toBeNull();
    expect(new Date(scheduled.scheduledDate as Date).toISOString().slice(0, 10)).toBe("2026-09-15");
  });

  it("assignTechnicianToWorkOrder réaffecte le technicien", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    const updated = await assignTechnicianToWorkOrder(wo.id, TECH_B);
    expect(updated.technicianId).toBe(TECH_B);
  });

  it("refuse d'affecter un technicien inexistant", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);

    await expect(assignTechnicianToWorkOrder(wo.id, "unknown-tech")).rejects.toThrow(WorkOrderConflictError);
  });
});

describe("pièces", () => {
  it("technicianReportMissingPart crée la pièce ET bascule WAITING_PARTS", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);
    await startWorkOrder(wo.id);

    const updated = await technicianReportMissingPart(TECH_A, wo.id, { label: "Disque de frein avant", quantity: 2 });
    expect(updated.status).toBe("WAITING_PARTS");
    expect(updated.parts).toHaveLength(1);
    expect(updated.parts[0].status).toBe("REQUESTED");
  });

  it("updateWorkOrderPartStatus RECEIVED trace l'événement", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);
    await startWorkOrder(wo.id);
    const withPart = await technicianReportMissingPart(TECH_A, wo.id, { label: "Disque de frein avant" });

    const received = await updateWorkOrderPartStatus(wo.id, withPart.parts[0].id, "RECEIVED");
    expect(received.parts[0].status).toBe("RECEIVED");
  });
});

describe("travaux supplémentaires", () => {
  it("requestAdditionalWork pose le flag sans toucher au devis accepté", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);
    const quoteTotalBefore = wo.quote.totalAmount;

    const updated = await requestAdditionalWork(wo.id, "Amortisseur arrière également usé.");
    expect(updated.additionalWorkRequested).toBe(true);
    expect(updated.additionalWorkNotes).toContain("Amortisseur");
    expect(updated.quote.totalAmount).toEqual(quoteTotalBefore);
  });
});

describe("espace client", () => {
  it("le client voit son Work Order avec l'immatriculation du véhicule, sans ressaisie", async () => {
    await createAcceptedQuote();
    const [wo] = await listWorkOrdersForCustomer(CUSTOMER_A);
    const detail = await getWorkOrderForProduction(wo.id);

    expect(detail.vehicle.licensePlate).toBe("AB123CD");
  });
});
