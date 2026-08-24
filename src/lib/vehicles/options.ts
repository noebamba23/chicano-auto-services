import { FuelType, TransmissionType, VehicleBodyType } from "@prisma/client";

// Source unique des libellés/valeurs de véhicule (section 2 de la Phase 2 :
// "prévoir des valeurs extensibles plutôt que de disperser les chaînes dans
// le code"). Les formulaires client et la validation serveur importent tous
// deux ce module — ajouter une valeur ne se fait qu'ici + dans le schéma
// Prisma (migration requise, ce qui est volontaire : ce sont des valeurs
// métier stables, pas une configuration à changer à chaud).

export const BODY_TYPE_OPTIONS: { value: VehicleBodyType; label: string }[] = [
  { value: "SEDAN", label: "Berline" },
  { value: "SUV", label: "SUV" },
  { value: "FOUR_BY_FOUR", label: "4x4" },
  { value: "VAN", label: "Utilitaire" },
  { value: "PICKUP", label: "Pick-up" },
  { value: "OTHER", label: "Autre" },
];

export const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: "ESSENCE", label: "Essence" },
  { value: "DIESEL", label: "Diesel" },
  { value: "HYBRID", label: "Hybride" },
  { value: "PLUGIN_HYBRID", label: "Hybride rechargeable" },
  { value: "ELECTRIC", label: "Électrique" },
  { value: "OTHER", label: "Autre" },
];

export const TRANSMISSION_OPTIONS: { value: TransmissionType; label: string }[] = [
  { value: "MANUAL", label: "Manuelle" },
  { value: "AUTOMATIC", label: "Automatique" },
  { value: "CVT", label: "CVT" },
  { value: "DCT", label: "DCT" },
  { value: "OTHER", label: "Autre" },
];

const bodyTypeLabels = new Map(BODY_TYPE_OPTIONS.map((o) => [o.value, o.label]));
const fuelTypeLabels = new Map(FUEL_TYPE_OPTIONS.map((o) => [o.value, o.label]));
const transmissionLabels = new Map(TRANSMISSION_OPTIONS.map((o) => [o.value, o.label]));

export function bodyTypeLabel(value: VehicleBodyType | null | undefined) {
  return value ? (bodyTypeLabels.get(value) ?? value) : null;
}

export function fuelTypeLabel(value: FuelType) {
  return fuelTypeLabels.get(value) ?? value;
}

export function transmissionLabel(value: TransmissionType | null | undefined) {
  return value ? (transmissionLabels.get(value) ?? value) : null;
}
