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
const {
  getOrCreateDraftReport,
  updateReportDraft,
  addReportPhoto,
  removeReportPhoto,
  publishReport,
  listPublishedReportsForCustomer,
  getPublishedReportForCustomer,
  ReportConflictError,
  ReportNotFoundError,
} = await import("./service");

const CUSTOMER_A = "customer-a";
const VEHICLE_A = "vehicle-a";
const TECH_A = "tech-a";

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
});

async function createCompletedDiagnostic() {
  const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
  const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-05", scheduledSlot: "08:00-10:00" });
  const assignment = await assignTechnician(accepted.id, TECH_A);
  await departForAssignment(TECH_A, assignment.id);
  await arriveForAssignment(TECH_A, assignment.id);
  const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});
  return completeDiagnostic(TECH_A, diagnostic.id, {});
}

describe("getOrCreateDraftReport", () => {
  it("crée un brouillon sur un diagnostic terminé", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const report = await getOrCreateDraftReport(diagnostic.id);

    expect(report.publishedAt).toBeNull();
    expect(report.reportNumber).toMatch(/^CHC-DR-\d{6}$/);
  });

  it("est idempotent : un second appel retourne le même brouillon", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const first = await getOrCreateDraftReport(diagnostic.id);
    const second = await getOrCreateDraftReport(diagnostic.id);

    expect(second.id).toBe(first.id);
  });

  it("refuse tant que le diagnostic n'est pas terminé", async () => {
    const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
    const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-05", scheduledSlot: "08:00-10:00" });
    const assignment = await assignTechnician(accepted.id, TECH_A);
    await departForAssignment(TECH_A, assignment.id);
    await arriveForAssignment(TECH_A, assignment.id);
    const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});

    await expect(getOrCreateDraftReport(diagnostic.id)).rejects.toThrow(ReportConflictError);
  });
});

describe("édition et publication", () => {
  it("met à jour la conclusion/sévérité d'un brouillon", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const report = await getOrCreateDraftReport(diagnostic.id);

    const updated = await updateReportDraft(report.id, { conclusion: "Freins à changer.", severity: "URGENT" });
    expect(updated.conclusion).toBe("Freins à changer.");
    expect(updated.severity).toBe("URGENT");
  });

  it("ajoute puis retire une photo de preuve", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const report = await getOrCreateDraftReport(diagnostic.id);

    const withPhoto = await addReportPhoto(report.id, { url: "https://example.com/photo.jpg" });
    expect(withPhoto.photos).toHaveLength(1);

    const withoutPhoto = await removeReportPhoto(report.id, withPhoto.photos[0].id);
    expect(withoutPhoto.photos).toHaveLength(0);
  });

  it("publie le rapport et le fige (plus aucune modification possible)", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const report = await getOrCreateDraftReport(diagnostic.id);

    const published = await publishReport(report.id, "staff-1");
    expect(published.publishedAt).not.toBeNull();

    await expect(updateReportDraft(report.id, { conclusion: "x" })).rejects.toThrow(ReportConflictError);
    await expect(addReportPhoto(report.id, { url: "https://example.com/x.jpg" })).rejects.toThrow(ReportConflictError);
  });
});

describe("espace client", () => {
  it("un brouillon non publié est invisible côté client", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const report = await getOrCreateDraftReport(diagnostic.id);

    const list = await listPublishedReportsForCustomer(CUSTOMER_A);
    expect(list).toHaveLength(0);
    await expect(getPublishedReportForCustomer(CUSTOMER_A, report.id)).rejects.toThrow(ReportNotFoundError);
  });

  it("un rapport publié devient visible pour le bon client, jamais pour un autre", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const report = await getOrCreateDraftReport(diagnostic.id);
    await publishReport(report.id, "staff-1");

    const list = await listPublishedReportsForCustomer(CUSTOMER_A);
    expect(list).toHaveLength(1);

    const owned = await getPublishedReportForCustomer(CUSTOMER_A, report.id);
    expect(owned.id).toBe(report.id);

    await expect(getPublishedReportForCustomer("customer-b", report.id)).rejects.toThrow(ReportNotFoundError);
  });
});
