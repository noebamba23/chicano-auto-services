import type { QuoteStatus, Prisma } from "@prisma/client";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  MODIFICATION_REQUESTED: "Modification demandée",
  EXPIRED: "Expiré",
};

export function quoteStatusLabel(value: QuoteStatus) {
  return QUOTE_STATUS_LABELS[value] ?? value;
}

// Franc CFA (XOF) — pas de décimales, séparateur de milliers (section
// "MONNAIE" du contexte malien). Accepte Prisma.Decimal (colonnes
// @db.Decimal) en plus de number/string — Number() fonctionne sur les trois.
export function formatXOF(amount: number | string | Prisma.Decimal | null | undefined) {
  if (amount === null || amount === undefined) return "—";
  return `${Math.round(Number(amount)).toLocaleString("fr-FR")} F CFA`;
}
