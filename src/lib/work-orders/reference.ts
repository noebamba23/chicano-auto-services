const PREFIX = "CHC-WO-";
const PAD_LENGTH = 6;

// Même principe que src/lib/quotes/reference.ts : dérivé du compteur natif
// Postgres WorkOrder.sequenceNumber (autoincrement), jamais la clé primaire.
export function formatWorkOrderReference(sequenceNumber: number): string {
  return `${PREFIX}${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}
