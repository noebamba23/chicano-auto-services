const PREFIX = "CHC-QT-";
const PAD_LENGTH = 6;

// Même principe que src/lib/service-requests/reference.ts : dérivé du
// compteur natif Postgres Quote.sequenceNumber (autoincrement, ajouté en
// Phase 6), jamais la clé primaire.
export function formatQuoteReference(sequenceNumber: number): string {
  return `${PREFIX}${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}
