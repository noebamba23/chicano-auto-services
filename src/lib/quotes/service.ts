import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { formatQuoteReference } from "./reference";
import { sendNotification } from "@/lib/notifications/service";
import { createWorkOrderFromQuote } from "@/lib/work-orders/service";
import type { Prisma } from "@prisma/client";

// Devis versionné (Phase 6) — cycle DRAFT → SENT → (ACCEPTED | REJECTED |
// MODIFICATION_REQUESTED) → SENT (v2) → ... . Chaque envoi crée une
// QuoteVersion immuable (ligne d'historique de négociation) plutôt que de
// modifier la version précédente — le client doit pouvoir comparer ce qui a
// changé. acceptQuote() déclenche automatiquement la création du WorkOrder
// (Phase 7, "QUOTE ACCEPTED → WORK ORDER CREATED") — voir
// src/lib/work-orders/service.ts et docs/WORK-ORDERS.md.

export class QuoteNotFoundError extends Error {
  constructor() {
    super("Devis introuvable.");
    this.name = "QuoteNotFoundError";
  }
}

export class QuoteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteConflictError";
  }
}

export interface QuoteItemInput {
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteVersionInput {
  laborAmount?: number;
  travelAmount?: number;
  discountAmount?: number;
  leadTimeDays?: number;
  terms?: string;
  items: QuoteItemInput[];
}

const QUOTE_INCLUDE = {
  vehicle: {
    select: { id: true, make: true, model: true, chicanoVehicleId: true, licensePlate: true, customerId: true },
  },
  diagnostic: {
    select: { id: true, appointment: { select: { serviceRequest: { select: { referenceNumber: true } } } } },
  },
  versions: { include: { items: true }, orderBy: { versionNumber: "asc" as const } },
} satisfies Prisma.QuoteInclude;

const ACTIVE_QUOTE_STATUSES = ["DRAFT", "SENT", "MODIFICATION_REQUESTED"] as const;

function computeTotal(input: QuoteVersionInput): number {
  const itemsTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return itemsTotal + (input.laborAmount ?? 0) + (input.travelAmount ?? 0) - (input.discountAmount ?? 0);
}

async function createVersion(quoteId: string, versionNumber: number, input: QuoteVersionInput) {
  const totalAmount = computeTotal(input);
  const version = await db.quoteVersion.create({
    data: {
      quoteId,
      versionNumber,
      laborAmount: input.laborAmount ?? null,
      travelAmount: input.travelAmount ?? null,
      discountAmount: input.discountAmount ?? null,
      totalAmount,
      leadTimeDays: input.leadTimeDays ?? null,
      terms: input.terms || null,
    },
  });

  for (const item of input.items) {
    await db.quoteItem.create({
      data: { quoteVersionId: version.id, label: item.label, quantity: item.quantity, unitPrice: item.unitPrice },
    });
  }

  return { version, totalAmount };
}

// Idempotent sur un devis déjà actif (DRAFT/SENT/MODIFICATION_REQUESTED) :
// retourne le devis en cours plutôt que d'en créer un second en parallèle.
// Une nouvelle création n'est possible qu'après un devis clos (ACCEPTED/
// REJECTED/EXPIRED) — cas légitime d'un nouveau devis après refus.
export async function createQuote(diagnosticId: string, input: QuoteVersionInput) {
  const diagnostic = await db.diagnostic.findUnique({ where: { id: diagnosticId } });
  if (!diagnostic) throw new QuoteNotFoundError();
  if (diagnostic.status !== "COMPLETED") {
    throw new QuoteConflictError("Le diagnostic doit être terminé avant de créer un devis.");
  }

  const existingActive = await db.quote.findFirst({
    where: { diagnosticId, status: { in: [...ACTIVE_QUOTE_STATUSES] } },
    include: QUOTE_INCLUDE,
  });
  if (existingActive) return existingActive;

  const created = await db.quote.create({
    data: {
      diagnosticId,
      vehicleId: diagnostic.vehicleId,
      quoteNumber: `pending-${randomUUID()}`,
      currentVersion: 1,
      status: "DRAFT",
    },
  });

  const { totalAmount } = await createVersion(created.id, 1, input);

  const withReference = await db.quote.update({
    where: { id: created.id },
    data: { quoteNumber: formatQuoteReference(created.sequenceNumber), totalAmount },
  });

  await db.auditLog.create({ data: { action: "QUOTE_CREATED", entity: "Quote", entityId: withReference.id } });

  return getQuoteForProduction(withReference.id);
}

export async function getQuoteForProduction(quoteId: string) {
  const quote = await db.quote.findUnique({ where: { id: quoteId }, include: QUOTE_INCLUDE });
  if (!quote) throw new QuoteNotFoundError();
  return quote;
}

export function getActiveQuoteForDiagnostic(diagnosticId: string) {
  return db.quote.findFirst({
    where: { diagnosticId },
    include: QUOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function sendQuoteToClient(quoteId: string) {
  const quote = await getQuoteForProduction(quoteId);
  if (quote.status !== "DRAFT") {
    throw new QuoteConflictError("Seul un devis en brouillon peut être envoyé.");
  }

  await db.quote.update({ where: { id: quoteId }, data: { status: "SENT" } });
  await db.auditLog.create({ data: { action: "QUOTE_SENT", entity: "Quote", entityId: quoteId } });
  await notifyQuoteAvailable(quote);

  return getQuoteForProduction(quoteId);
}

// Nouvelle version suite à une demande de modification client — SEULE façon
// de faire évoluer un devis déjà envoyé (jamais d'édition en place d'une
// version existante, qui casserait l'historique de négociation visible par
// le client).
export async function createQuoteVersion(quoteId: string, input: QuoteVersionInput) {
  const quote = await getQuoteForProduction(quoteId);
  if (quote.status !== "MODIFICATION_REQUESTED") {
    throw new QuoteConflictError("Une nouvelle version ne peut être créée qu'après une demande de modification.");
  }

  const nextVersion = quote.currentVersion + 1;
  const { totalAmount } = await createVersion(quoteId, nextVersion, input);

  await db.quote.update({
    where: { id: quoteId },
    data: { currentVersion: nextVersion, status: "SENT", totalAmount },
  });

  await db.auditLog.create({
    data: { action: "QUOTE_VERSION_CREATED", entity: "Quote", entityId: quoteId, newValue: { versionNumber: nextVersion } },
  });

  const updated = await getQuoteForProduction(quoteId);
  await notifyQuoteAvailable(updated);

  return updated;
}

async function notifyQuoteAvailable(quote: { vehicle: { customerId: string }; quoteNumber: string }) {
  const customer = await db.customer.findUnique({ where: { id: quote.vehicle.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "QUOTE_AVAILABLE", { reference: quote.quoteNumber });
  }
}

// ============================================================
// ESPACE CLIENT — ownership via Quote.vehicleId → Customer, un devis DRAFT
// (pas encore envoyé) se comporte comme inexistant côté client.
// ============================================================

function assertQuoteOwnership<T extends { vehicle: { customerId: string } }>(quote: T, customerId: string): T {
  if (quote.vehicle.customerId !== customerId) throw new QuoteNotFoundError();
  return quote;
}

export function listQuotesForCustomer(customerId: string) {
  return db.quote.findMany({
    where: { status: { not: "DRAFT" }, vehicle: { customerId } },
    include: QUOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

async function getOwnedSentQuote(customerId: string, quoteId: string) {
  const quote = await getQuoteForProduction(quoteId);
  assertQuoteOwnership(quote, customerId);
  return quote;
}

export async function getQuoteForCustomer(customerId: string, quoteId: string) {
  const quote = await getOwnedSentQuote(customerId, quoteId);
  if (quote.status === "DRAFT") throw new QuoteNotFoundError();
  return quote;
}

export async function acceptQuote(customerId: string, quoteId: string) {
  const quote = await getOwnedSentQuote(customerId, quoteId);
  if (quote.status !== "SENT") {
    throw new QuoteConflictError("Ce devis ne peut plus être accepté dans son état actuel.");
  }

  await db.quote.update({
    where: { id: quoteId },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: customerId },
  });
  await db.auditLog.create({ data: { action: "QUOTE_ACCEPTED", entity: "Quote", entityId: quoteId } });

  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "QUOTE_ACCEPTED", { reference: quote.quoteNumber });
  }

  await createWorkOrderFromQuote(quoteId);

  return getQuoteForProduction(quoteId);
}

export async function rejectQuote(customerId: string, quoteId: string, reason?: string) {
  const quote = await getOwnedSentQuote(customerId, quoteId);
  if (quote.status !== "SENT") {
    throw new QuoteConflictError("Ce devis ne peut plus être refusé dans son état actuel.");
  }

  await db.quote.update({ where: { id: quoteId }, data: { status: "REJECTED" } });
  await db.auditLog.create({
    data: { action: "QUOTE_REJECTED", entity: "Quote", entityId: quoteId, newValue: { reason } },
  });

  return getQuoteForProduction(quoteId);
}

export async function requestQuoteModification(customerId: string, quoteId: string, note?: string) {
  const quote = await getOwnedSentQuote(customerId, quoteId);
  if (quote.status !== "SENT") {
    throw new QuoteConflictError("Une modification ne peut être demandée que sur un devis envoyé.");
  }

  await db.quote.update({ where: { id: quoteId }, data: { status: "MODIFICATION_REQUESTED" } });
  await db.auditLog.create({
    data: { action: "QUOTE_MODIFICATION_REQUESTED", entity: "Quote", entityId: quoteId, newValue: { note } },
  });

  return getQuoteForProduction(quoteId);
}
