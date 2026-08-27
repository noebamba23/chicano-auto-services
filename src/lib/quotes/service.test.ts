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
  createQuote,
  sendQuoteToClient,
  createQuoteVersion,
  acceptQuote,
  rejectQuote,
  requestQuoteModification,
  listQuotesForCustomer,
  getQuoteForCustomer,
  QuoteConflictError,
  QuoteNotFoundError,
} = await import("./service");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";
const TECH_A = "tech-a";

const VALID_INPUT = {
  vehicleId: VEHICLE_A,
  category: "DIAGNOSTIC" as const,
  description: "Le véhicule ne démarre plus.",
  interventionType: "AT_GARAGE" as const,
  isUrgent: false,
} as Parameters<typeof createServiceRequest>[1];

const ITEMS = [{ label: "Plaquettes de frein", quantity: 2, unitPrice: 15000 }];

beforeEach(() => {
  fakeDb._reset();
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, licensePlate: "AB123CD" });
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedTechnician({ id: TECH_A, user: { firstName: "DEMO", lastName: "TECHNICIEN A" } });
});

async function createCompletedDiagnostic() {
  const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
  const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-06", scheduledSlot: "08:00-10:00" });
  const assignment = await assignTechnician(accepted.id, TECH_A);
  await departForAssignment(TECH_A, assignment.id);
  await arriveForAssignment(TECH_A, assignment.id);
  const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});
  return completeDiagnostic(TECH_A, diagnostic.id, {});
}

describe("createQuote", () => {
  it("crée un devis DRAFT avec le total calculé", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const quote = await createQuote(diagnostic.id, { items: ITEMS, laborAmount: 5000 });

    expect(quote.status).toBe("DRAFT");
    expect(quote.quoteNumber).toMatch(/^CHC-QT-\d{6}$/);
    expect(Number(quote.totalAmount)).toBe(2 * 15000 + 5000);
  });

  // Évolution "IMMATRICULATION MALI", section 17/20 (cas 16) : le devis
  // hérite l'immatriculation du véhicule, jamais ressaisie.
  it("hérite l'immatriculation du véhicule sans ressaisie", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const quote = await createQuote(diagnostic.id, { items: ITEMS });
    expect(quote.vehicle.licensePlate).toBe("AB123CD");
  });

  it("est idempotent tant qu'un devis actif existe déjà", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const first = await createQuote(diagnostic.id, { items: ITEMS });
    const second = await createQuote(diagnostic.id, { items: ITEMS });

    expect(second.id).toBe(first.id);
  });
});

describe("cycle d'envoi et de réponse client", () => {
  it("DRAFT → SENT → ACCEPTED", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const created = await createQuote(diagnostic.id, { items: ITEMS });
    await sendQuoteToClient(created.id);

    const accepted = await acceptQuote(CUSTOMER_A, created.id);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.acceptedAt).not.toBeNull();
  });

  it("DRAFT → SENT → REJECTED", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const created = await createQuote(diagnostic.id, { items: ITEMS });
    await sendQuoteToClient(created.id);

    const rejected = await rejectQuote(CUSTOMER_A, created.id, "Trop cher");
    expect(rejected.status).toBe("REJECTED");
  });

  it("refuse d'accepter un devis encore en brouillon (jamais envoyé)", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const created = await createQuote(diagnostic.id, { items: ITEMS });

    await expect(acceptQuote(CUSTOMER_A, created.id)).rejects.toThrow(QuoteConflictError);
  });

  it("un autre client ne peut ni voir ni répondre à ce devis (404, jamais 403)", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const created = await createQuote(diagnostic.id, { items: ITEMS });
    await sendQuoteToClient(created.id);

    await expect(getQuoteForCustomer(CUSTOMER_B, created.id)).rejects.toThrow(QuoteNotFoundError);
    await expect(acceptQuote(CUSTOMER_B, created.id)).rejects.toThrow(QuoteNotFoundError);
  });
});

describe("cycle de renégociation (versions)", () => {
  it("SENT → MODIFICATION_REQUESTED → nouvelle version → SENT (v2)", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const created = await createQuote(diagnostic.id, { items: ITEMS });
    await sendQuoteToClient(created.id);
    await requestQuoteModification(CUSTOMER_A, created.id, "Trop cher, une remise ?");

    const v2 = await createQuoteVersion(created.id, { items: ITEMS, discountAmount: 5000 });
    expect(v2.status).toBe("SENT");
    expect(v2.currentVersion).toBe(2);
    expect(v2.versions).toHaveLength(2);
    expect(Number(v2.totalAmount)).toBe(2 * 15000 - 5000);
  });

  it("refuse une nouvelle version hors du statut MODIFICATION_REQUESTED", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const created = await createQuote(diagnostic.id, { items: ITEMS });
    await sendQuoteToClient(created.id);

    await expect(createQuoteVersion(created.id, { items: ITEMS })).rejects.toThrow(QuoteConflictError);
  });

  it("un devis refusé n'empêche pas la création d'un nouveau devis", async () => {
    const diagnostic = await createCompletedDiagnostic();
    const first = await createQuote(diagnostic.id, { items: ITEMS });
    await sendQuoteToClient(first.id);
    await rejectQuote(CUSTOMER_A, first.id);

    const second = await createQuote(diagnostic.id, { items: ITEMS });
    expect(second.id).not.toBe(first.id);
  });
});

describe("espace client", () => {
  it("un devis DRAFT (jamais envoyé) est invisible côté client", async () => {
    const diagnostic = await createCompletedDiagnostic();
    await createQuote(diagnostic.id, { items: ITEMS });

    const list = await listQuotesForCustomer(CUSTOMER_A);
    expect(list).toHaveLength(0);
  });
});
