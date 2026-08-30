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

const { createServiceRequest, acceptServiceRequest } = await import("@/lib/service-requests/service");
const { assignTechnician, departForAssignment, arriveForAssignment } = await import("@/lib/technicians/service");
const { startDiagnostic, completeDiagnostic } = await import("@/lib/diagnostics/service");
const { createQuote, sendQuoteToClient, acceptQuote } = await import("@/lib/quotes/service");
const { startWorkOrder, sendToQualityCheck, passQualityCheck, requestAdditionalWork } = await import(
  "@/lib/work-orders/service"
);
const {
  createInvoiceFromWorkOrder,
  issueInvoice,
  cancelInvoice,
  recordPayment,
  computeWorkOrderMargin,
  listInvoicesForCustomer,
  getInvoiceForCustomer,
  InvoiceNotFoundError,
  InvoiceConflictError,
  PaymentValidationError,
} = await import("./service");

// Row loosement typé côté fake db — même convention que les autres fichiers
// de tests de ce projet (ce fake teste la logique applicative, pas la forme
// Prisma exacte, vérifiée en conditions réelles via Neon).
type AnyRow = Record<string, unknown> & { id: string };

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";
const TECH_A = "tech-a";

const VALID_INPUT = {
  vehicleId: VEHICLE_A,
  category: "REPAIR" as const,
  description: "Freins à changer.",
  interventionType: "AT_GARAGE" as const,
  isUrgent: false,
} as Parameters<typeof createServiceRequest>[1];

const ITEMS = [{ label: "Plaquettes de frein", quantity: 2, unitPrice: 15_000 }];

beforeEach(() => {
  fakeDb._reset();
  vi.clearAllMocks();
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, licensePlate: "AB123CD" });
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedCustomer({ id: CUSTOMER_B, userId: "user-b" });
  fakeDb._seedTechnician({ id: TECH_A, user: { firstName: "DEMO", lastName: "TECHNICIEN A" } });
});

async function acceptedWorkOrder(laborAmount: number) {
  const request = await createServiceRequest(CUSTOMER_A, VALID_INPUT);
  const accepted = await acceptServiceRequest(request.id, { scheduledDate: "2026-09-10", scheduledSlot: "08:00-10:00" });
  const assignment = await assignTechnician(accepted.id, TECH_A);
  await departForAssignment(TECH_A, assignment.id);
  await arriveForAssignment(TECH_A, assignment.id);
  const diagnostic = await startDiagnostic(TECH_A, assignment.id, {});
  await completeDiagnostic(TECH_A, diagnostic.id, {});
  const quote = await createQuote(diagnostic.id, { items: ITEMS, laborAmount });
  await sendQuoteToClient(quote.id);
  const acceptedQuote = await acceptQuote(CUSTOMER_A, quote.id);
  return (await fakeDb.workOrder.findFirst({ where: { quoteId: acceptedQuote.id } })) as AnyRow;
}

// Chaîne complète jusqu'au Work Order COMPLETED (déclenche automatiquement
// la création de la facture — voir passQualityCheck()).
async function createCompletedWorkOrder(laborAmount = 5000) {
  const workOrder = await acceptedWorkOrder(laborAmount);
  await startWorkOrder(workOrder.id);
  await sendToQualityCheck(workOrder.id);
  return (await passQualityCheck(workOrder.id, "admin-1", {})) as AnyRow;
}

async function invoiceForWorkOrder(workOrderId: string) {
  return (await fakeDb.invoice.findUnique({ where: { workOrderId } })) as AnyRow;
}

describe("création automatique depuis un Work Order terminé", () => {
  it("QUALITY_CHECK PASSED → COMPLETED → Invoice créée, référence CHC-FAC-000001", async () => {
    const wo = await createCompletedWorkOrder();
    const invoices = await listInvoicesForCustomer(CUSTOMER_A);
    const invoice = await invoiceForWorkOrder(wo.id);

    expect(invoice.invoiceNumber).toMatch(/^CHC-FAC-\d{6}$/);
    expect(invoice.status).toBe("DRAFT");
    expect(invoices).toHaveLength(0); // DRAFT non visible côté client
  });

  it("snapshot des lignes du Work Order — jamais recalculé depuis le devis", async () => {
    const wo = await createCompletedWorkOrder();
    const invoice = await invoiceForWorkOrder(wo.id);

    expect((invoice.items as unknown[]).length).toBeGreaterThanOrEqual(2); // plaquettes + main-d'œuvre
    expect(Number(invoice.subtotal)).toBe(2 * 15_000 + 5000);
    expect(Number(invoice.total)).toBe(2 * 15_000 + 5000);
  });

  it("idempotente : un second appel ne duplique pas la facture", async () => {
    const wo = await createCompletedWorkOrder();
    const first = await invoiceForWorkOrder(wo.id);

    const second = await createInvoiceFromWorkOrder(wo.id);
    expect(second.id).toBe(first.id);

    const all = await fakeDb.invoice.findMany({ where: { workOrderId: wo.id } });
    expect(all).toHaveLength(1);
  });

  it("refuse une facture depuis un Work Order non terminé", async () => {
    const workOrder = await acceptedWorkOrder(5000);
    // WorkOrder encore SCHEDULED, pas COMPLETED.
    await expect(createInvoiceFromWorkOrder(workOrder.id)).rejects.toThrow(InvoiceConflictError);
  });
});

describe("cycle de statut", () => {
  it("DRAFT → ISSUED", async () => {
    const wo = await createCompletedWorkOrder();
    const invoice = await invoiceForWorkOrder(wo.id);
    const issued = await issueInvoice(invoice.id);

    expect(issued.status).toBe("ISSUED");
    expect(issued.issuedAt).not.toBeNull();
    expect(issued.dueAt).not.toBeNull();
  });

  it("une facture ISSUED apparaît côté client", async () => {
    const wo = await createCompletedWorkOrder();
    const invoice = await invoiceForWorkOrder(wo.id);
    await issueInvoice(invoice.id);

    const list = await listInvoicesForCustomer(CUSTOMER_A);
    expect(list).toHaveLength(1);
  });

  it("annulation", async () => {
    const wo = await createCompletedWorkOrder();
    const invoice = await invoiceForWorkOrder(wo.id);
    const cancelled = await cancelInvoice(invoice.id, "Erreur de saisie");
    expect(cancelled.status).toBe("CANCELLED");
  });
});

describe("paiements", () => {
  async function issuedInvoiceFor(laborAmount = 5000) {
    const wo = await createCompletedWorkOrder(laborAmount);
    const invoice = await invoiceForWorkOrder(wo.id);
    return issueInvoice(invoice.id);
  }

  it("paiement unique intégral → PAID", async () => {
    const invoice = await issuedInvoiceFor();
    const total = Number(invoice.total);

    const { invoice: paid } = await recordPayment(invoice.id, { amount: total, method: "CASH" });
    expect(paid.status).toBe("PAID");
    expect(Number(paid.amountPaid)).toBe(total);
    expect(Number(paid.balanceDue)).toBe(0);
  });

  it("paiement partiel → PARTIALLY_PAID, solde correct", async () => {
    const invoice = await issuedInvoiceFor();
    const total = Number(invoice.total);

    const { invoice: partial } = await recordPayment(invoice.id, { amount: 15_000, method: "CASH" });
    expect(partial.status).toBe("PARTIALLY_PAID");
    expect(Number(partial.balanceDue)).toBe(total - 15_000);
  });

  it("acompte puis solde → PAID (exemple 150 000 + 300 000 sur 450 000)", async () => {
    const wo = await createCompletedWorkOrder(150_000);
    const invoice = await invoiceForWorkOrder(wo.id);
    await fakeDb.invoiceItem.create({
      data: { invoiceId: invoice.id, type: "PART", description: "Pièce", quantity: 1, unitPrice: 150_000, total: 150_000 },
    });
    await fakeDb.invoice.update({ where: { id: invoice.id }, data: { subtotal: 450_000, total: 450_000, balanceDue: 450_000 } });
    const issued = await issueInvoice(invoice.id);

    const first = await recordPayment(issued.id, { amount: 150_000, method: "CASH" });
    expect(first.invoice.status).toBe("PARTIALLY_PAID");
    expect(Number(first.invoice.balanceDue)).toBe(300_000);

    const second = await recordPayment(issued.id, { amount: 300_000, method: "CASH" });
    expect(second.invoice.status).toBe("PAID");
    expect(Number(second.invoice.balanceDue)).toBe(0);
    expect(Number(second.invoice.amountPaid)).toBe(450_000);
  });

  it("refuse un paiement supérieur au solde restant", async () => {
    const invoice = await issuedInvoiceFor();
    await expect(recordPayment(invoice.id, { amount: Number(invoice.total) + 1, method: "CASH" })).rejects.toThrow(
      PaymentValidationError
    );
  });

  it("refuse un paiement nul ou négatif", async () => {
    const invoice = await issuedInvoiceFor();
    await expect(recordPayment(invoice.id, { amount: 0, method: "CASH" })).rejects.toThrow(PaymentValidationError);
    await expect(recordPayment(invoice.id, { amount: -100, method: "CASH" })).rejects.toThrow(PaymentValidationError);
  });

  it("génère un reçu uniquement une fois le paiement confirmé", async () => {
    const invoice = await issuedInvoiceFor();
    const { payment } = await recordPayment(invoice.id, { amount: 5000, method: "CASH" });
    expect(payment?.receiptNumber).toMatch(/^CHC-RC-\d{6}$/);
  });

  it("Mobile Money non configuré → FAILED, jamais PAID, aucun faux paiement", async () => {
    const invoice = await issuedInvoiceFor();
    const { payment, invoice: unchanged } = await recordPayment(invoice.id, { amount: 5000, method: "ORANGE_MONEY" });

    expect(payment?.status).toBe("FAILED");
    expect(payment?.receiptNumber).toBeNull();
    expect(unchanged.status).toBe("ISSUED");
    expect(Number(unchanged.amountPaid)).toBe(0);
    expect(sendNotification).toHaveBeenCalledWith("user-a", "PAYMENT_FAILED", expect.any(Object));
  });

  it("notifications : PAYMENT_PARTIAL puis PAYMENT_RECEIVED + INVOICE_PAID", async () => {
    const invoice = await issuedInvoiceFor();
    await recordPayment(invoice.id, { amount: 10_000, method: "CASH" });
    expect(sendNotification).toHaveBeenCalledWith("user-a", "PAYMENT_PARTIAL", expect.any(Object));

    vi.clearAllMocks();
    await recordPayment(invoice.id, { amount: Number(invoice.total) - 10_000, method: "CASH" });
    expect(sendNotification).toHaveBeenCalledWith("user-a", "PAYMENT_RECEIVED", expect.any(Object));
    expect(sendNotification).toHaveBeenCalledWith("user-a", "INVOICE_PAID", expect.any(Object));
  });
});

describe("ownership", () => {
  it("client A ne peut pas voir la facture d'un autre client (404)", async () => {
    const wo = await createCompletedWorkOrder();
    const invoice = await invoiceForWorkOrder(wo.id);
    await issueInvoice(invoice.id);

    await expect(getInvoiceForCustomer(CUSTOMER_B, invoice.id)).rejects.toThrow(InvoiceNotFoundError);
  });

  it("le propriétaire voit sa facture émise", async () => {
    const wo = await createCompletedWorkOrder();
    const invoice = await invoiceForWorkOrder(wo.id);
    await issueInvoice(invoice.id);

    await expect(getInvoiceForCustomer(CUSTOMER_A, invoice.id)).resolves.toBeTruthy();
  });
});

describe("marge (jamais exposée au client)", () => {
  it("calcule REVENUE - PARTS - LABOR - OTHER = GROSS MARGIN", async () => {
    const wo = await createCompletedWorkOrder(50_000);
    const invoice = await invoiceForWorkOrder(wo.id);
    await fakeDb.invoice.update({ where: { id: invoice.id }, data: { subtotal: 350_000, travelFee: 10_000, total: 360_000 } });

    const fullWorkOrder = (await fakeDb.workOrder.findUnique({ where: { id: wo.id } })) as AnyRow;
    const items = fullWorkOrder.items as AnyRow[];
    const partItem = items.find((i) => i.type !== "LABOR");
    const laborItem = items.find((i) => i.type === "LABOR");
    if (partItem) await fakeDb.workOrderItem.update({ where: { id: partItem.id }, data: { costPrice: 180_000 } });
    if (laborItem) await fakeDb.workOrderItem.update({ where: { id: laborItem.id }, data: { costPrice: 50_000 } });

    const margin = await computeWorkOrderMargin(wo.id);
    expect(margin.revenue).toBe(360_000); // subtotal + travelFee - discount
    expect(margin.partsCost).toBe(180_000);
    expect(margin.laborCost).toBe(50_000);
    expect(margin.grossMargin).toBe(360_000 - 180_000 - 50_000);
  });
});

describe("travaux supplémentaires — jamais de modification silencieuse du devis", () => {
  it("requestAdditionalWork sur le WorkOrder ne modifie ni le devis ni la facture déjà créée", async () => {
    const wo = await createCompletedWorkOrder();
    const invoiceBefore = await invoiceForWorkOrder(wo.id);
    const totalBefore = Number(invoiceBefore.total);

    await requestAdditionalWork(wo.id, "Amortisseur également usé.");

    const invoiceAfter = await invoiceForWorkOrder(wo.id);
    expect(Number(invoiceAfter.total)).toBe(totalBefore);
  });
});
