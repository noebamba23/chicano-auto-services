import { InterventionType, ServiceCategory, ServiceRequestStatus, UrgencyReason } from "@prisma/client";

// Source unique des libellés/valeurs de demande de service — même principe
// que src/lib/vehicles/options.ts (section 4 de la Phase 2, reconduite en
// Phase 3) : le formulaire et l'affichage importent ce module plutôt que de
// disperser des chaînes dans les composants.

export const SERVICE_CATEGORY_OPTIONS: { value: ServiceCategory; label: string; emoji: string }[] = [
  { value: "DIAGNOSTIC", label: "Diagnostic automobile", emoji: "🔧" },
  { value: "MAINTENANCE", label: "Entretien", emoji: "🛠" },
  { value: "REPAIR", label: "Réparation", emoji: "⚙️" },
  { value: "ELECTRICAL", label: "Électricité automobile", emoji: "⚡" },
  { value: "KEY_PROGRAMMING", label: "Programmation de clé", emoji: "🔑" },
  { value: "PRE_PURCHASE_INSPECTION", label: "Expertise avant achat", emoji: "🔎" },
  { value: "TECHNICAL_VISIT_PREP", label: "Préparation visite technique", emoji: "📋" },
  { value: "ASSISTANCE", label: "Assistance", emoji: "🚗" },
  { value: "OTHER", label: "Autre", emoji: "❓" },
];

export const INTERVENTION_TYPE_OPTIONS: { value: InterventionType; label: string; emoji: string }[] = [
  { value: "AT_GARAGE", label: "Au garage CHICANO", emoji: "🏭" },
  { value: "MOBILE", label: "CHICANO vient à moi", emoji: "🚗" },
];

export const URGENCY_REASON_OPTIONS: { value: UrgencyReason; label: string }[] = [
  { value: "VEHICLE_IMMOBILIZED", label: "Véhicule immobilisé" },
  { value: "ENGINE_WONT_START", label: "Le moteur ne démarre plus" },
  { value: "BATTERY", label: "Batterie" },
  { value: "ELECTRICAL_FAILURE", label: "Panne électrique" },
  { value: "FLAT_TIRE", label: "Crevaison" },
  { value: "CRITICAL_WARNING_LIGHT", label: "Voyant critique" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "OTHER", label: "Autre" },
];

// Créneaux configurables (section "CRÉNEAU" de la Phase 3) — modifier cette
// liste suffit à changer l'offre affichée au client, sans toucher au schéma
// (stockés comme simple libellé sur ServiceRequest.preferredSlot /
// Appointment.scheduledSlot).
export const SERVICE_SLOTS: { value: string; label: string }[] = [
  { value: "08:00-10:00", label: "08:00 – 10:00" },
  { value: "10:00-12:00", label: "10:00 – 12:00" },
  { value: "14:00-16:00", label: "14:00 – 16:00" },
  { value: "16:00-18:00", label: "16:00 – 18:00" },
  { value: "18:00-20:00", label: "18:00 – 20:00" },
  { value: "20:00-22:00", label: "20:00 – 22:00" },
];

const categoryLabels = new Map(SERVICE_CATEGORY_OPTIONS.map((o) => [o.value, o]));
const interventionLabels = new Map(INTERVENTION_TYPE_OPTIONS.map((o) => [o.value, o.label]));
const urgencyReasonLabels = new Map(URGENCY_REASON_OPTIONS.map((o) => [o.value, o.label]));
const slotLabels = new Map(SERVICE_SLOTS.map((o) => [o.value, o.label]));

export function serviceCategoryLabel(value: ServiceCategory) {
  return categoryLabels.get(value)?.label ?? value;
}

export function serviceCategoryEmoji(value: ServiceCategory) {
  return categoryLabels.get(value)?.emoji ?? "🔧";
}

export function interventionTypeLabel(value: InterventionType) {
  return interventionLabels.get(value) ?? value;
}

export function urgencyReasonLabel(value: UrgencyReason | null | undefined) {
  return value ? (urgencyReasonLabels.get(value) ?? value) : null;
}

export function slotLabel(value: string | null | undefined) {
  return value ? (slotLabels.get(value) ?? value) : null;
}

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "En cours de traitement",
  UNDER_REVIEW: "En cours d'examen",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  RESCHEDULE_REQUESTED: "Nouveau créneau proposé",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

export function serviceRequestStatusLabel(value: ServiceRequestStatus) {
  return SERVICE_REQUEST_STATUS_LABELS[value] ?? value;
}
