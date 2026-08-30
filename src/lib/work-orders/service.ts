import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { formatWorkOrderReference } from "./reference";
import { sendNotification } from "@/lib/notifications/service";
import { completeMaintenanceFromWorkOrder } from "@/lib/maintenance/service";
import type { Prisma, WorkOrderStatus, WorkOrderPartStatus, WorkOrderPhotoPhase, MaintenanceType } from "@prisma/client";

// Work Order (Phase 7) — "DEVIS ACCEPTÉ → WORK ORDER → PLANIFICATION →
// AFFECTATION → EXÉCUTION → PIÈCES → MAIN-D'ŒUVRE → CONTRÔLE QUALITÉ →
// TERMINÉ". Créé automatiquement par createWorkOrderFromQuote() (appelé
// depuis quotes/service.ts::acceptQuote(), jamais depuis une route de
// création manuelle — voir docs/WORK-ORDERS.md, section "Création"). Même
// discipline que le reste de la plateforme : ownership 404, transitions
// validées côté serveur uniquement, AuditLog réutilisé pour l'historique
// (pas de nouvelle table dédiée).

export class WorkOrderNotFoundError extends Error {
  constructor() {
    super("Ordre de réparation introuvable.");
    this.name = "WorkOrderNotFoundError";
  }
}

export class WorkOrderConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkOrderConflictError";
  }
}

const TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 10_000 };

const WORK_ORDER_INCLUDE = {
  customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
  vehicle: { select: { id: true, make: true, model: true, chicanoVehicleId: true, licensePlate: true } },
  serviceRequest: { select: { id: true, referenceNumber: true, category: true, interventionType: true } },
  appointment: { select: { id: true, scheduledDate: true, scheduledSlot: true } },
  quote: { select: { id: true, quoteNumber: true, currentVersion: true, totalAmount: true, currency: true } },
  diagnosticReport: { select: { id: true, reportNumber: true, conclusion: true, severity: true } },
  technician: { select: { id: true, user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
  items: { orderBy: { createdAt: "asc" as const } },
  parts: { orderBy: { createdAt: "asc" as const } },
  photos: { orderBy: { createdAt: "asc" as const } },
  transfer: true,
} satisfies Prisma.WorkOrderInclude;

// Transitions autorisées — contrôlées uniquement côté serveur (jamais par le
// frontend), même discipline que ServiceRequestStatus. QUALITY_CHECK →
// IN_PROGRESS couvre le contrôle qualité échoué (renvoyé en travaux) ;
// WAITING_PARTS/ON_HOLD → IN_PROGRESS couvre la reprise.
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  DRAFT: ["READY", "SCHEDULED", "CANCELLED"],
  READY: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_PARTS", "ON_HOLD", "QUALITY_CHECK", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  QUALITY_CHECK: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function assertTransition(current: WorkOrderStatus, target: WorkOrderStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new WorkOrderConflictError(
      `Transition impossible : un ordre ${current} ne peut pas passer à ${target}.`
    );
  }
}

// ============================================================
// CRÉATION — déclenchée uniquement par acceptQuote() (quotes/service.ts).
// Idempotent sur quoteId (contrainte unique) : un second appel retourne le
// Work Order déjà créé plutôt que d'en dupliquer un.
// ============================================================

export async function createWorkOrderFromQuote(quoteId: string) {
  const existing = await db.workOrder.findUnique({ where: { quoteId } });
  if (existing) return getWorkOrderForProduction(existing.id);

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      vehicle: { select: { id: true, customerId: true } },
      diagnostic: {
        select: {
          id: true,
          appointmentId: true,
          report: { select: { id: true } },
          appointment: { select: { serviceRequestId: true, scheduledDate: true } },
        },
      },
    },
  });
  if (!quote) throw new WorkOrderNotFoundError();
  if (quote.status !== "ACCEPTED") {
    throw new WorkOrderConflictError("Un ordre de réparation ne peut être créé que depuis un devis accepté.");
  }

  const serviceRequest = await db.serviceRequest.findUnique({
    where: { id: quote.diagnostic.appointment.serviceRequestId },
    select: { id: true, isUrgent: true },
  });
  if (!serviceRequest) throw new WorkOrderNotFoundError();

  // Technicien déjà affecté au rendez-vous (diagnostic), s'il existe —
  // récupéré automatiquement, jamais ressaisi (voir règle "aucune ressaisie
  // inutile" du prompt Phase 7).
  const activeAssignment = await db.technicianAssignment.findFirst({
    where: { appointmentId: quote.diagnostic.appointmentId, status: { not: "REASSIGNED" } },
    orderBy: { createdAt: "desc" },
    select: { technicianId: true },
  });

  const acceptedVersion = await db.quoteVersion.findUnique({
    where: { quoteId_versionNumber: { quoteId: quote.id, versionNumber: quote.currentVersion } },
    include: { items: true },
  });

  const scheduledDate = quote.diagnostic.appointment?.scheduledDate ?? null;
  const initialStatus: WorkOrderStatus = scheduledDate ? "SCHEDULED" : "READY";

  const created = await db.$transaction(async (tx) => {
    const wo = await tx.workOrder.create({
      data: {
        workOrderNumber: `pending-${randomUUID()}`,
        customerId: quote.vehicle.customerId,
        vehicleId: quote.vehicle.id,
        serviceRequestId: serviceRequest.id,
        appointmentId: quote.diagnostic.appointmentId ?? null,
        quoteId: quote.id,
        acceptedQuoteVersionNumber: quote.currentVersion,
        diagnosticReportId: quote.diagnostic.report?.id ?? null,
        technicianId: activeAssignment?.technicianId ?? null,
        priority: serviceRequest.isUrgent ? "URGENT" : "NORMAL",
        status: "DRAFT",
      },
    });

    const withReference = await tx.workOrder.update({
      where: { id: wo.id },
      data: {
        workOrderNumber: formatWorkOrderReference(wo.sequenceNumber),
        status: initialStatus,
        scheduledDate,
      },
    });

    // Reprend les lignes du devis accepté comme travaux approuvés — jamais
    // saisies librement (voir règle "ne pas modifier silencieusement le
    // périmètre financier approuvé").
    if (acceptedVersion) {
      for (const item of acceptedVersion.items) {
        await tx.workOrderItem.create({
          data: {
            workOrderId: withReference.id,
            type: item.partId ? "PART" : "SERVICE",
            description: item.label,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: Number(item.quantity) * Number(item.unitPrice),
            sourceQuoteItemId: item.id,
          },
        });
      }
      if (acceptedVersion.laborAmount && Number(acceptedVersion.laborAmount) > 0) {
        await tx.workOrderItem.create({
          data: {
            workOrderId: withReference.id,
            type: "LABOR",
            description: "Main-d'œuvre",
            quantity: 1,
            unitPrice: acceptedVersion.laborAmount,
            totalPrice: acceptedVersion.laborAmount,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: { action: "WORK_ORDER_CREATED", entity: "WorkOrder", entityId: withReference.id, newValue: { status: initialStatus } },
    });
    if (initialStatus === "SCHEDULED") {
      await tx.auditLog.create({
        data: { action: "WORK_ORDER_SCHEDULED", entity: "WorkOrder", entityId: withReference.id, newValue: { scheduledDate } },
      });
    }

    return withReference;
  }, TRANSACTION_OPTIONS);

  const customer = await db.customer.findUnique({ where: { id: quote.vehicle.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "WORK_ORDER_CREATED", { reference: created.workOrderNumber });
    if (initialStatus === "SCHEDULED" && scheduledDate) {
      await sendNotification(customer.userId, "WORK_SCHEDULED", {
        reference: created.workOrderNumber,
        date: scheduledDate.toLocaleDateString("fr-FR"),
      });
    }
  }

  return getWorkOrderForProduction(created.id);
}

// ============================================================
// PRODUCTION — accès non filtré par ownership, gardé par RBAC au niveau des
// routes (requireProductionRole).
// ============================================================

export interface WorkOrderProductionFilters {
  status?: WorkOrderStatus;
}

export function listWorkOrdersForProduction(filters: WorkOrderProductionFilters = {}) {
  return db.workOrder.findMany({
    where: { status: filters.status },
    include: WORK_ORDER_INCLUDE,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function getWorkOrderForProduction(id: string) {
  const workOrder = await db.workOrder.findUnique({ where: { id }, include: WORK_ORDER_INCLUDE });
  if (!workOrder) throw new WorkOrderNotFoundError();
  return workOrder;
}

export async function scheduleWorkOrder(id: string, input: { scheduledDate: string }) {
  const wo = await getWorkOrderForProduction(id);
  if (wo.status !== "SCHEDULED") assertTransition(wo.status, "SCHEDULED");

  await db.workOrder.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledDate: new Date(input.scheduledDate) },
  });
  await db.auditLog.create({
    data: { action: "WORK_ORDER_SCHEDULED", entity: "WorkOrder", entityId: id, newValue: { scheduledDate: input.scheduledDate } },
  });

  const customer = await db.customer.findUnique({ where: { id: wo.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "WORK_SCHEDULED", {
      reference: wo.workOrderNumber,
      date: new Date(input.scheduledDate).toLocaleDateString("fr-FR"),
    });
  }

  return getWorkOrderForProduction(id);
}

export async function assignTechnicianToWorkOrder(id: string, technicianId: string) {
  const wo = await getWorkOrderForProduction(id);
  if (wo.status === "COMPLETED" || wo.status === "CANCELLED") {
    throw new WorkOrderConflictError("Cet ordre de réparation est clos, il ne peut plus être réaffecté.");
  }

  const technician = await db.technician.findUnique({ where: { id: technicianId } });
  if (!technician) throw new WorkOrderConflictError("Technicien introuvable.");

  await db.workOrder.update({ where: { id }, data: { technicianId } });
  await db.auditLog.create({
    data: { action: "TECHNICIAN_ASSIGNED", entity: "WorkOrder", entityId: id, newValue: { technicianId } },
  });

  return getWorkOrderForProduction(id);
}

async function transitionStatus(id: string, target: WorkOrderStatus, action: string) {
  const wo = await getWorkOrderForProduction(id);
  assertTransition(wo.status, target);

  await db.workOrder.update({ where: { id }, data: { status: target } });
  await db.auditLog.create({ data: { action, entity: "WorkOrder", entityId: id, newValue: { status: target } } });

  return getWorkOrderForProduction(id);
}

export async function startWorkOrder(id: string) {
  const result = await transitionStatus(id, "IN_PROGRESS", "WORK_STARTED");

  const customer = await db.customer.findUnique({ where: { id: result.customerId }, select: { userId: true } });
  if (customer) await sendNotification(customer.userId, "WORK_STARTED", { reference: result.workOrderNumber });

  return result;
}

export async function pauseWorkOrder(id: string) {
  return transitionStatus(id, "ON_HOLD", "WORK_PAUSED");
}

export async function resumeWorkOrder(id: string) {
  const wo = await getWorkOrderForProduction(id);
  if (wo.status !== "WAITING_PARTS" && wo.status !== "ON_HOLD") {
    throw new WorkOrderConflictError("Cet ordre n'est ni en attente de pièces, ni en pause.");
  }
  return transitionStatus(id, "IN_PROGRESS", "WORK_RESUMED");
}

export async function markWaitingParts(id: string) {
  const wo = await getWorkOrderForProduction(id);
  // Idempotent : un ordre déjà en attente de pièces reste tel quel (ex. un
  // technicien signale une seconde pièce manquante avant réception de la
  // première) plutôt que de rejeter la transition.
  const result = wo.status === "WAITING_PARTS" ? wo : await transitionStatus(id, "WAITING_PARTS", "WORK_WAITING_PARTS_STARTED");

  const customer = await db.customer.findUnique({ where: { id: result.customerId }, select: { userId: true } });
  if (customer) await sendNotification(customer.userId, "WORK_WAITING_PARTS", { reference: result.workOrderNumber });

  return result;
}

export async function sendToQualityCheck(id: string) {
  return transitionStatus(id, "QUALITY_CHECK", "QUALITY_CHECK_STARTED");
}

// Contrôle qualité — VALIDER : passe la fiche à COMPLETED, uniquement si le
// contrôle est renseigné (voir règle "un Work Order ne peut pas passer à
// COMPLETED sans contrôle qualité validé").
export async function passQualityCheck(
  id: string,
  checkedById: string,
  input: { notes?: string; testDrivePerformed?: boolean; testDriveNotes?: string }
) {
  const wo = await getWorkOrderForProduction(id);
  assertTransition(wo.status, "COMPLETED");

  await db.$transaction([
    db.workOrder.update({
      where: { id },
      data: {
        status: "COMPLETED",
        qualityCheckPassed: true,
        qualityCheckNotes: input.notes || null,
        qualityCheckedById: checkedById,
        qualityCheckedAt: new Date(),
        testDrivePerformed: input.testDrivePerformed ?? false,
        testDriveNotes: input.testDriveNotes || null,
      },
    }),
    db.auditLog.create({
      data: { action: "QUALITY_CHECK_PASSED", entity: "WorkOrder", entityId: id },
    }),
    db.auditLog.create({
      data: { action: "WORK_COMPLETED", entity: "WorkOrder", entityId: id },
    }),
  ]);

  const customer = await db.customer.findUnique({ where: { id: wo.customerId }, select: { userId: true } });
  if (customer) await sendNotification(customer.userId, "WORK_COMPLETED", { reference: wo.workOrderNumber });

  // Carnet automobile (Phase 8) — un entretien n'est jamais réalisé sans
  // intervention réellement terminée : c'est ici, et nulle part ailleurs,
  // que les rappels liés sont clos et la prochaine échéance calculée.
  await completeMaintenanceFromWorkOrder(id);

  return getWorkOrderForProduction(id);
}

// Contrôle qualité échoué — renvoie en travaux plutôt que de clôturer.
export async function failQualityCheck(id: string, checkedById: string, notes: string) {
  const wo = await getWorkOrderForProduction(id);
  assertTransition(wo.status, "IN_PROGRESS");

  await db.$transaction([
    db.workOrder.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        qualityCheckPassed: false,
        qualityCheckNotes: notes || null,
        qualityCheckedById: checkedById,
        qualityCheckedAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: { action: "QUALITY_CHECK_FAILED", entity: "WorkOrder", entityId: id, newValue: { notes } },
    }),
  ]);

  return getWorkOrderForProduction(id);
}

export async function cancelWorkOrder(id: string, reason?: string) {
  const wo = await getWorkOrderForProduction(id);
  assertTransition(wo.status, "CANCELLED");

  await db.$transaction([
    db.workOrder.update({ where: { id }, data: { status: "CANCELLED" } }),
    db.auditLog.create({
      data: { action: "WORK_CANCELLED", entity: "WorkOrder", entityId: id, newValue: { reason } },
    }),
  ]);

  return getWorkOrderForProduction(id);
}

// Travaux supplémentaires — signal léger uniquement (voir docs/WORK-ORDERS.md) :
// ne modifie jamais le devis accepté ni le total financier.
export async function requestAdditionalWork(id: string, notes: string) {
  await getWorkOrderForProduction(id);

  await db.$transaction([
    db.workOrder.update({ where: { id }, data: { additionalWorkRequested: true, additionalWorkNotes: notes || null } }),
    db.auditLog.create({
      data: { action: "ADDITIONAL_WORK_REQUIRED", entity: "WorkOrder", entityId: id, newValue: { notes } },
    }),
  ]);

  return getWorkOrderForProduction(id);
}

// ============================================================
// PIÈCES
// ============================================================

export async function addWorkOrderPart(
  workOrderId: string,
  input: { label: string; reference?: string; quantity?: number; partId?: string }
) {
  await getWorkOrderForProduction(workOrderId);

  const part = await db.workOrderPart.create({
    data: {
      workOrderId,
      label: input.label,
      reference: input.reference || null,
      quantity: input.quantity ?? 1,
      partId: input.partId || null,
    },
  });

  await db.auditLog.create({
    data: { action: "PART_REQUESTED", entity: "WorkOrderPart", entityId: part.id, newValue: { workOrderId, label: input.label } },
  });

  return getWorkOrderForProduction(workOrderId);
}

export async function updateWorkOrderPartStatus(workOrderId: string, partId: string, status: WorkOrderPartStatus) {
  const wo = await getWorkOrderForProduction(workOrderId);
  const target = wo.parts.find((p) => p.id === partId);
  if (!target) throw new WorkOrderNotFoundError();

  await db.workOrderPart.update({ where: { id: partId }, data: { status } });
  await db.auditLog.create({
    data: { action: status === "RECEIVED" ? "PART_RECEIVED" : "PART_STATUS_CHANGED", entity: "WorkOrderPart", entityId: partId, newValue: { status } },
  });

  return getWorkOrderForProduction(workOrderId);
}

// ============================================================
// TRAVAUX / MAIN-D'ŒUVRE
// ============================================================

export async function updateWorkOrderItem(
  workOrderId: string,
  itemId: string,
  input: {
    status?: "PENDING" | "DONE";
    actualMinutes?: number;
    technicianId?: string;
    // Phase 8 — rattache cette ligne au carnet d'entretien (voir
    // src/lib/maintenance/service.ts::completeMaintenanceFromWorkOrder,
    // déclenché uniquement quand ce Work Order passe à COMPLETED).
    maintenanceType?: MaintenanceType | null;
  }
) {
  const wo = await getWorkOrderForProduction(workOrderId);
  const target = wo.items.find((i) => i.id === itemId);
  if (!target) throw new WorkOrderNotFoundError();

  await db.workOrderItem.update({
    where: { id: itemId },
    data: {
      status: input.status,
      actualMinutes: input.actualMinutes,
      technicianId: input.technicianId,
      maintenanceType: input.maintenanceType,
    },
  });

  return getWorkOrderForProduction(workOrderId);
}

// ============================================================
// PHOTOS
// ============================================================

export async function addWorkOrderPhoto(
  workOrderId: string,
  input: { phase: WorkOrderPhotoPhase; url: string; storageKey?: string; caption?: string }
) {
  await getWorkOrderForProduction(workOrderId);

  await db.workOrderPhoto.create({
    data: {
      workOrderId,
      phase: input.phase,
      url: input.url,
      storageKey: input.storageKey || null,
      caption: input.caption || null,
    },
  });

  return getWorkOrderForProduction(workOrderId);
}

// ============================================================
// EMBARQUEMENT GARAGE (mobile → réparation impossible sur place)
// ============================================================

export async function requestWorkshopTransfer(
  workOrderId: string,
  input: { reason: string; vehicleCondition?: string; destination?: string; transferredById?: string }
) {
  await getWorkOrderForProduction(workOrderId);

  await db.$transaction([
    db.workOrder.update({ where: { id: workOrderId }, data: { requiresTowing: true } }),
    db.workshopTransfer.create({
      data: {
        workOrderId,
        reason: input.reason,
        vehicleCondition: input.vehicleCondition || null,
        destination: input.destination || null,
        transferredById: input.transferredById || null,
      },
    }),
    db.auditLog.create({
      data: { action: "WORKSHOP_TRANSFER_CREATED", entity: "WorkOrder", entityId: workOrderId, newValue: { reason: input.reason } },
    }),
  ]);

  return getWorkOrderForProduction(workOrderId);
}

export async function receiveWorkshopTransfer(workOrderId: string) {
  const wo = await getWorkOrderForProduction(workOrderId);
  if (!wo.transfer) throw new WorkOrderConflictError("Aucun embarquement en cours pour cet ordre.");

  await db.workshopTransfer.update({ where: { workOrderId }, data: { receivedAt: new Date() } });
  await db.auditLog.create({
    data: { action: "WORKSHOP_TRANSFER_RECEIVED", entity: "WorkOrder", entityId: workOrderId },
  });

  return getWorkOrderForProduction(workOrderId);
}

// ============================================================
// ESPACE TECHNICIEN — ownership stricte : un technicien n'agit que sur SES
// propres ordres (404, jamais 403), même discipline que technicians/service.ts.
// ============================================================

export function listWorkOrdersForTechnician(technicianId: string) {
  return db.workOrder.findMany({
    where: { technicianId },
    include: WORK_ORDER_INCLUDE,
    orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
  });
}

export async function getWorkOrderForTechnician(technicianId: string, id: string) {
  const workOrder = await db.workOrder.findFirst({ where: { id, technicianId }, include: WORK_ORDER_INCLUDE });
  if (!workOrder) throw new WorkOrderNotFoundError();
  return workOrder;
}

export async function technicianStartWorkOrder(technicianId: string, id: string) {
  await getWorkOrderForTechnician(technicianId, id);
  return startWorkOrder(id);
}

export async function technicianPauseWorkOrder(technicianId: string, id: string) {
  await getWorkOrderForTechnician(technicianId, id);
  return pauseWorkOrder(id);
}

export async function technicianReportMissingPart(
  technicianId: string,
  id: string,
  input: { label: string; reference?: string; quantity?: number }
) {
  await getWorkOrderForTechnician(technicianId, id);
  await markWaitingParts(id);
  return addWorkOrderPart(id, input);
}

export async function technicianSendToQualityCheck(technicianId: string, id: string) {
  await getWorkOrderForTechnician(technicianId, id);
  return sendToQualityCheck(id);
}

export async function technicianRecordWork(
  technicianId: string,
  id: string,
  itemId: string,
  input: { status?: "PENDING" | "DONE"; actualMinutes?: number }
) {
  await getWorkOrderForTechnician(technicianId, id);
  return updateWorkOrderItem(id, itemId, { ...input, technicianId });
}

export async function technicianRequestAdditionalWork(technicianId: string, id: string, notes: string) {
  await getWorkOrderForTechnician(technicianId, id);
  return requestAdditionalWork(id, notes);
}

// ============================================================
// ESPACE CLIENT — lecture seule, ownership via customerId.
// ============================================================

export function listWorkOrdersForCustomer(customerId: string) {
  return db.workOrder.findMany({
    where: { customerId },
    include: WORK_ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getWorkOrderForCustomer(customerId: string, id: string) {
  const workOrder = await db.workOrder.findFirst({ where: { id, customerId }, include: WORK_ORDER_INCLUDE });
  if (!workOrder) throw new WorkOrderNotFoundError();
  return workOrder;
}
