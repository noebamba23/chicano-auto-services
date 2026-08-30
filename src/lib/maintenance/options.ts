import type { MaintenanceType, ReminderStatus, MaintenanceReminderLevel } from "@prisma/client";

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  OIL_CHANGE: "Vidange moteur",
  OIL_FILTER: "Filtre à huile",
  AIR_FILTER: "Filtre à air",
  FUEL_FILTER: "Filtre à carburant",
  BRAKES: "Freins",
  BRAKE_FLUID: "Liquide de frein",
  TIRES: "Pneus",
  BATTERY: "Batterie",
  AIR_CONDITIONING: "Climatisation",
  TIMING_BELT: "Courroie de distribution",
  SPARK_PLUGS: "Bougies",
  TRANSMISSION: "Transmission",
  COOLANT: "Liquide de refroidissement",
  TECHNICAL_INSPECTION: "Visite technique",
  PERIODIC_SERVICE: "Entretien périodique",
  OTHER: "Autre",
};

export function maintenanceTypeLabel(value: MaintenanceType) {
  return MAINTENANCE_TYPE_LABELS[value] ?? value;
}

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: "En attente",
  SCHEDULED: "Planifié",
  SENT: "Notifié",
  COMPLETED: "Réalisé",
  CANCELLED: "Annulé",
};

export function reminderStatusLabel(value: ReminderStatus) {
  return REMINDER_STATUS_LABELS[value] ?? value;
}

export const REMINDER_LEVEL_LABELS: Record<MaintenanceReminderLevel, string> = {
  UPCOMING: "À venir",
  DUE: "À faire",
  OVERDUE: "En retard",
};

export function reminderLevelLabel(value: MaintenanceReminderLevel) {
  return REMINDER_LEVEL_LABELS[value] ?? value;
}
