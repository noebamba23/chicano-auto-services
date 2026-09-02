import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { formatInvoiceReference, formatPaymentReference, formatReceiptReference } from "./reference";
import { sendNotification } from "@/lib/notifications/service";
import { getPaymentProvider } from "@/lib/payments/get-provider";
import type { Prisma, InvoiceStatus, PaymentMethod, WorkOrderItemType } from "@prisma/client";

// Facturation (Phase 9) — "DIAGNOSTIC → RAPPORT → DEVIS → ACCEPTATION →
// WORK ORDER → TRAVAUX → CONTRÔLE QUALITÉ → FACTURE → PAIEMENT → REÇU →
// SOLDE". Le devis accepté reste la référence commerciale, le Work Order la
// référence opérationnelle, la facture la référence financière, le paiement
// la preuve d'encaissement. Aucune nouvelle logique de prix parallèle : la
// facture est un snapshot des lignes du Work Order (déjà lui-même un
// snapshot du devis accepté depuis la Phase 7).

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("Facture introuvable.");
    this.name = "InvoiceNotFoundError";
  }
}

export class InvoiceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceConflictError";
  }
}

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentValidationError";
  }
}

const TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 10_000 };

const INVOICE_INCLUDE = {
  customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
  vehicle: { select: { id: true, make: true, model: true, chicanoVehicleId: true, licensePlate: true } },
  workOrder: { select: { id: true, workOrderNumber: true } },
  items: { orderBy: { id: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.InvoiceInclude;

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "CANCELLED"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

function assertTransition(current: InvoiceStatus, target: InvoiceStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new InvoiceConflictError(`Transition impossible : une facture ${current} ne peut pas passer à ${target}.`);
  }
}

const WORK_ORDER_ITEM_TO_INVOICE_ITEM_TYPE: Record<WorkOrderItemType, "LABOR" | "PART" | "SERVICE" | "OTHER"> = {
  LABOR: "LABOR",
  PART: "PART",
  SERVICE: "SERVICE",
  OTHER: "OTHER",
};

// ============================================================
// CRÉATION — déclenchée uniquement par passQualityCheck() (WorkOrder
// COMPLETED), jamais avant, jamais manuellement. Idempotente : workOrderId
// est unique sur Invoice, un second appel retourne la facture déjà créée.
// ============================================================

export async function createInvoiceFromWorkOrder(workOrderId: string) {
  const existing = await db.invoice.findUnique({ where: { workOrderId } });
  if (existing) return getInvoiceForProduction(existing.id);

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: { items: true },
  });
  if (!workOrder) throw new InvoiceNotFoundError();
  if (workOrder.status !== "COMPLETED") {
    throw new InvoiceConflictError("Une facture ne peut être créée que depuis un Work Order terminé.");
  }

  const subtotal = workOrder.items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0);

  const created = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `pending-${randomUUID()}`,
        customerId: workOrder.customerId,
        vehicleId: workOrder.vehicleId,
        workOrderId: workOrder.id,
        quoteId: workOrder.quoteId,
        quoteVersionNumber: workOrder.acceptedQuoteVersionNumber,
        subtotal,
        total: subtotal,
        balanceDue: subtotal,
        status: "DRAFT",
      },
    });

    const withReference = await tx.invoice.update({
      where: { id: invoice.id },
      data: { invoiceNumber: formatInvoiceReference(invoice.sequenceNumber) },
    });

    // Snapshot des lignes — reprend WorkOrderItem tel quel, jamais
    // recalculé depuis le devis (déjà lui-même figé côté WorkOrder).
    for (const item of workOrder.items) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: withReference.id,
          type: WORK_ORDER_ITEM_TO_INVOICE_ITEM_TYPE[item.type],
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice ?? 0,
          total: item.totalPrice ?? 0,
          sourceWorkOrderItemId: item.id,
        },
      });
    }

    await tx.auditLog.create({
      data: { action: "INVOICE_CREATED", entity: "Invoice", entityId: withReference.id, newValue: { total: subtotal } },
    });

    return withReference;
  }, TRANSACTION_OPTIONS);

  return getInvoiceForProduction(created.id);
}

export async function getInvoiceForProduction(id: string) {
  const invoice = await db.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!invoice) throw new InvoiceNotFoundError();
  return invoice;
}

export interface InvoiceProductionFilters {
  status?: InvoiceStatus;
  customerId?: string;
}

// customerId optionnel (Phase 10, Customer 360) — contrairement à
// listInvoicesForCustomer() côté espace client, n'exclut jamais les
// factures DRAFT : la production doit voir qu'un Work Order terminé a
// généré une facture en attente d'émission.
export function listInvoicesForProduction(filters: InvoiceProductionFilters = {}) {
  return db.invoice.findMany({
    where: { status: filters.status, customerId: filters.customerId },
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

// Une facture ISSUED n'est plus modifiable en place — seule une nouvelle
// ligne de travaux supplémentaires (nouveau devis/version, Phase 7) peut
// faire évoluer le montant, jamais une édition silencieuse (voir règle
// fondamentale).
function assertEditable(invoice: { status: InvoiceStatus }) {
  if (invoice.status !== "DRAFT") {
    throw new InvoiceConflictError("Cette facture est émise et ne peut plus être modifiée.");
  }
}

export async function updateInvoiceCharges(
  invoiceId: string,
  input: { discount?: number; travelFee?: number; tax?: number; dueAt?: string }
) {
  const invoice = await getInvoiceForProduction(invoiceId);
  assertEditable(invoice);

  const discount = input.discount ?? Number(invoice.discount);
  const travelFee = input.travelFee ?? Number(invoice.travelFee);
  const tax = input.tax ?? Number(invoice.tax);
  const total = Number(invoice.subtotal) + travelFee + tax - discount;

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      discount,
      travelFee,
      tax,
      total,
      balanceDue: total - Number(invoice.amountPaid),
      dueAt: input.dueAt ? new Date(input.dueAt) : invoice.dueAt,
    },
  });

  return getInvoiceForProduction(invoiceId);
}

// DRAFT → ISSUED : figée à partir d'ici (assertEditable bloque toute
// modification des lignes/montants ensuite).
export async function issueInvoice(invoiceId: string) {
  const invoice = await getInvoiceForProduction(invoiceId);
  assertTransition(invoice.status, "ISSUED");

  const dueAt = invoice.dueAt ?? new Date(Date.now() + 30 * 86_400_000);

  await db.$transaction([
    db.invoice.update({ where: { id: invoiceId }, data: { status: "ISSUED", issuedAt: new Date(), dueAt } }),
    db.auditLog.create({ data: { action: "INVOICE_ISSUED", entity: "Invoice", entityId: invoiceId } }),
  ]);

  const customer = await db.customer.findUnique({ where: { id: invoice.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "INVOICE_ISSUED", { reference: invoice.invoiceNumber });
  }

  return getInvoiceForProduction(invoiceId);
}

export async function cancelInvoice(invoiceId: string, reason?: string) {
  const invoice = await getInvoiceForProduction(invoiceId);
  assertTransition(invoice.status, "CANCELLED");

  await db.$transaction([
    db.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } }),
    db.auditLog.create({ data: { action: "INVOICE_CANCELLED", entity: "Invoice", entityId: invoiceId, newValue: { reason } } }),
  ]);

  return getInvoiceForProduction(invoiceId);
}

// Déclenchement manuel (aucun scheduler/cron dans ce projet, même limite
// que docs/MAINTENANCE.md) : marque OVERDUE toute facture ISSUED/
// PARTIALLY_PAID dont l'échéance est dépassée.
export async function markOverdueInvoices() {
  const candidates = await db.invoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueAt: { lt: new Date() } },
  });

  for (const invoice of candidates) {
    await db.$transaction([
      db.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } }),
      db.auditLog.create({ data: { action: "INVOICE_OVERDUE", entity: "Invoice", entityId: invoice.id } }),
    ]);
  }

  return { checked: candidates.length, marked: candidates.length };
}

// ============================================================
// PAIEMENTS — un seul point d'entrée, quel que soit le rôle appelant. Le
// provider détermine l'issue réelle (CASH/BANK_TRANSFER/OTHER confirment
// immédiatement — attestation directe de la production ; Mobile Money
// retourne toujours NOT_CONFIGURED tant qu'aucune intégration réelle
// n'existe). Jamais de paiement > solde restant, jamais de montant ≤ 0.
// ============================================================

export async function recordPayment(
  invoiceId: string,
  input: { amount: number; method: PaymentMethod; customerPhone?: string; externalReference?: string; notes?: string }
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new PaymentValidationError("Le montant du paiement doit être strictement positif.");
  }

  const invoice = await getInvoiceForProduction(invoiceId);
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
    throw new InvoiceConflictError("Cette facture n'est pas dans un état permettant un paiement.");
  }

  const balanceDue = Number(invoice.balanceDue);
  if (input.amount > balanceDue) {
    throw new PaymentValidationError(
      `Le paiement (${input.amount}) dépasse le solde restant dû (${balanceDue}).`
    );
  }

  const provider = getPaymentProvider(input.method);
  const result = await provider.initiate({
    amount: input.amount,
    customerPhone: input.customerPhone ?? "",
    invoiceNumber: invoice.invoiceNumber,
  });

  const created = await db.payment.create({
    data: {
      paymentNumber: `pending-${randomUUID()}`,
      invoiceId,
      customerId: invoice.customerId,
      amount: input.amount,
      method: input.method,
      status: result.status === "CONFIRMED" ? "CONFIRMED" : "FAILED",
      externalReference: input.externalReference || null,
      transactionReference: result.transactionReference || null,
      notes: input.notes || result.message || null,
      paidAt: result.status === "CONFIRMED" ? new Date() : null,
    },
  });

  const withReference = await db.payment.update({
    where: { id: created.id },
    data: { paymentNumber: formatPaymentReference(created.sequenceNumber) },
  });

  await db.auditLog.create({
    data: {
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: withReference.id,
      newValue: { amount: input.amount, method: input.method, status: withReference.status },
    },
  });

  const customer = await db.customer.findUnique({ where: { id: invoice.customerId }, select: { userId: true } });

  if (result.status !== "CONFIRMED") {
    if (customer) await sendNotification(customer.userId, "PAYMENT_FAILED", { reference: invoice.invoiceNumber });
    return { payment: withReference, invoice };
  }

  // Confirmé — pose le reçu, met à jour le solde de la facture, jamais
  // amountPaid > total (garantie ici, la garde d'amont sur balanceDue
  // rend ce cas déjà impossible, mais l'invariant reste vérifié).
  const receiptNumber = formatReceiptReference(withReference.sequenceNumber);
  const newAmountPaid = Number(invoice.amountPaid) + input.amount;
  const newBalanceDue = Math.max(0, Number(invoice.total) - newAmountPaid);
  const newStatus: InvoiceStatus = newAmountPaid >= Number(invoice.total) ? "PAID" : "PARTIALLY_PAID";

  await db.$transaction([
    db.payment.update({ where: { id: withReference.id }, data: { receiptNumber } }),
    db.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
      },
    }),
    db.auditLog.create({ data: { action: "PAYMENT_CONFIRMED", entity: "Payment", entityId: withReference.id } }),
  ]);

  if (customer) {
    await sendNotification(customer.userId, newStatus === "PAID" ? "PAYMENT_RECEIVED" : "PAYMENT_PARTIAL", {
      reference: invoice.invoiceNumber,
      amount: String(input.amount),
    });
    if (newStatus === "PAID") {
      await db.auditLog.create({ data: { action: "INVOICE_PAID", entity: "Invoice", entityId: invoiceId } });
      await sendNotification(customer.userId, "INVOICE_PAID", { reference: invoice.invoiceNumber });
    }
  }

  const finalPayment = await db.payment.findUnique({ where: { id: withReference.id } });
  const finalInvoice = await getInvoiceForProduction(invoiceId);
  return { payment: finalPayment!, invoice: finalInvoice };
}

// ============================================================
// MARGE — jamais exposée au client ni au technicien (voir RBAC des routes
// appelantes). Le déplacement n'a pas de coût distinctement suivi dans
// cette phase (aucune ligne WorkOrderItem ne représente le déplacement) —
// travelCost reste à 0, limite documentée dans docs/BILLING.md.
// ============================================================

export interface WorkOrderMargin {
  revenue: number;
  partsCost: number;
  laborCost: number;
  travelCost: number;
  otherCost: number;
  grossMargin: number;
}

export async function computeWorkOrderMargin(workOrderId: string): Promise<WorkOrderMargin> {
  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: { items: true, invoice: true },
  });
  if (!workOrder) throw new InvoiceNotFoundError();

  const revenue = workOrder.invoice
    ? Number(workOrder.invoice.subtotal) + Number(workOrder.invoice.travelFee) - Number(workOrder.invoice.discount)
    : workOrder.items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0);

  const costByType = (type: WorkOrderItemType) =>
    workOrder.items.filter((i) => i.type === type).reduce((sum, i) => sum + Number(i.costPrice ?? 0), 0);

  const partsCost = costByType("PART") + costByType("SERVICE");
  const laborCost = costByType("LABOR");
  const otherCost = costByType("OTHER");
  const travelCost = 0;

  return {
    revenue,
    partsCost,
    laborCost,
    travelCost,
    otherCost,
    grossMargin: revenue - partsCost - laborCost - travelCost - otherCost,
  };
}

// ============================================================
// ESPACE CLIENT — ownership.
// ============================================================

export function listInvoicesForCustomer(customerId: string) {
  return db.invoice.findMany({
    where: { customerId, status: { not: "DRAFT" } },
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoiceForCustomer(customerId: string, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, customerId, status: { not: "DRAFT" } },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) throw new InvoiceNotFoundError();
  return invoice;
}

// PAYER côté client — Mobile Money uniquement (CASH/virement restent une
// saisie production, attestant une transaction déjà réalisée en personne).
// Ne lance jamais une transaction externe réelle : aucun provider configuré
// dans cette phase, voir getPaymentProvider().
export async function initiateClientPayment(
  customerId: string,
  invoiceId: string,
  input: { amount: number; method: Extract<PaymentMethod, "ORANGE_MONEY" | "MOOV_MONEY" | "WAVE">; customerPhone?: string }
) {
  const invoice = await getInvoiceForCustomer(customerId, invoiceId);
  return recordPayment(invoice.id, input);
}
