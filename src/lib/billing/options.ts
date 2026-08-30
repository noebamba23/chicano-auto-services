import type { InvoiceStatus, InvoiceItemType, PaymentMethod, PaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

export function invoiceStatusLabel(value: InvoiceStatus) {
  return INVOICE_STATUS_LABELS[value] ?? value;
}

export const INVOICE_ITEM_TYPE_LABELS: Record<InvoiceItemType, string> = {
  LABOR: "Main-d'œuvre",
  PART: "Pièce",
  SERVICE: "Service",
  TRAVEL: "Déplacement",
  OTHER: "Autre",
};

export function invoiceItemTypeLabel(value: InvoiceItemType) {
  return INVOICE_ITEM_TYPE_LABELS[value] ?? value;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  WAVE: "Wave",
  BANK_TRANSFER: "Virement bancaire",
  OTHER: "Autre",
};

export function paymentMethodLabel(value: PaymentMethod) {
  return PAYMENT_METHOD_LABELS[value] ?? value;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

export function paymentStatusLabel(value: PaymentStatus) {
  return PAYMENT_STATUS_LABELS[value] ?? value;
}

// Franc CFA (XOF) — même formatage que src/lib/quotes/options.ts, dupliqué
// ici volontairement pour ne pas créer une dépendance croisée quotes↔billing
// sur un simple formateur (aucune logique métier partagée).
export function formatXOF(amount: number | string | Prisma.Decimal | null | undefined) {
  if (amount === null || amount === undefined) return "—";
  return `${Math.round(Number(amount)).toLocaleString("fr-FR")} F CFA`;
}
