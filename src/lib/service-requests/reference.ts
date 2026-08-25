const PREFIX = "CHC-SR-";
const PAD_LENGTH = 6;

// Même principe que src/lib/vehicles/vehicle-id.ts : dérivé du compteur natif
// Postgres ServiceRequest.sequenceNumber (autoincrement), jamais la clé
// primaire — un identifiant métier lisible et recherchable.
export function formatServiceRequestReference(sequenceNumber: number): string {
  return `${PREFIX}${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}
