import type {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderItemType,
  WorkOrderItemStatus,
  WorkOrderPartStatus,
} from "@prisma/client";

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: "Brouillon",
  READY: "Prêt",
  SCHEDULED: "Planifié",
  IN_PROGRESS: "Travaux en cours",
  WAITING_PARTS: "En attente de pièces",
  QUALITY_CHECK: "Contrôle qualité",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  ON_HOLD: "En pause",
};

export function workOrderStatusLabel(value: WorkOrderStatus) {
  return WORK_ORDER_STATUS_LABELS[value] ?? value;
}

export const WORK_ORDER_PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  NORMAL: "Normale",
  URGENT: "Urgente",
};

export function workOrderPriorityLabel(value: WorkOrderPriority) {
  return WORK_ORDER_PRIORITY_LABELS[value] ?? value;
}

export const WORK_ORDER_ITEM_TYPE_LABELS: Record<WorkOrderItemType, string> = {
  LABOR: "Main-d'œuvre",
  PART: "Pièce",
  SERVICE: "Service",
  OTHER: "Autre",
};

export function workOrderItemTypeLabel(value: WorkOrderItemType) {
  return WORK_ORDER_ITEM_TYPE_LABELS[value] ?? value;
}

export const WORK_ORDER_ITEM_STATUS_LABELS: Record<WorkOrderItemStatus, string> = {
  PENDING: "À faire",
  DONE: "Fait",
};

export function workOrderItemStatusLabel(value: WorkOrderItemStatus) {
  return WORK_ORDER_ITEM_STATUS_LABELS[value] ?? value;
}

export const WORK_ORDER_PART_STATUS_LABELS: Record<WorkOrderPartStatus, string> = {
  REQUESTED: "Demandée",
  AVAILABLE: "Disponible",
  ORDERED: "Commandée",
  RECEIVED: "Reçue",
  INSTALLED: "Installée",
  NOT_REQUIRED: "Non requise",
};

export function workOrderPartStatusLabel(value: WorkOrderPartStatus) {
  return WORK_ORDER_PART_STATUS_LABELS[value] ?? value;
}
