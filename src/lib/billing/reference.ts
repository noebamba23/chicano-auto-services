const PAD_LENGTH = 6;

// Même principe que les autres références métier (Vehicle.sequenceNumber,
// Quote.sequenceNumber...) — dérivé d'un compteur natif Postgres, jamais la
// clé primaire.
export function formatInvoiceReference(sequenceNumber: number): string {
  return `CHC-FAC-${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}

export function formatPaymentReference(sequenceNumber: number): string {
  return `CHC-PAY-${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}

// Le reçu n'est pas une table séparée — c'est une référence posée sur le
// Payment une fois CONFIRMED (voir docs/BILLING.md). Dérivée du même
// compteur que paymentNumber, préfixe distinct pour rester lisible.
export function formatReceiptReference(sequenceNumber: number): string {
  return `CHC-RC-${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}
