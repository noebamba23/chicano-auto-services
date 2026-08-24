const PREFIX = "CHC-VH-";
const PAD_LENGTH = 6;

// L'identifiant métier CHICANO Vehicle ID (section 3 de la Phase 2) est dérivé
// du compteur natif Postgres `Vehicle.sequenceNumber` (colonne
// @default(autoincrement())) : ce compteur est incrémenté de façon atomique
// par la base même en cas de créations concurrentes, ce qui évite toute
// collision sans avoir à gérer un verrou applicatif. chicanoVehicleId n'est
// jamais la clé primaire — seulement un identifiant lisible et recherchable.
export function formatChicanoVehicleId(sequenceNumber: number): string {
  return `${PREFIX}${String(sequenceNumber).padStart(PAD_LENGTH, "0")}`;
}
