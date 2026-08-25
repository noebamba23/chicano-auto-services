import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { formatServiceRequestReference } from "./reference";
import { getVehicleForCustomer, VehicleConflictError } from "@/lib/vehicles/service";
import { sendNotification } from "@/lib/notifications/service";
import type { CreateServiceRequestInput } from "@/lib/validation/service-requests";
import type { Prisma, ServiceRequestStatus } from "@prisma/client";

// Couche de service ServiceRequest / Appointment (Phase 3). Même discipline
// que src/lib/vehicles/service.ts : ownership systématique côté serveur,
// jamais de confiance dans un id transmis par le client sans vérification,
// erreurs métier typées plutôt que des booléens/exceptions génériques.
//
// RÈGLE D'ARCHITECTURE (section dédiée du prompt Phase 3) : ServiceRequest
// ("le client demande") ≠ Appointment ("un créneau est planifié") ≠
// Intervention future. Cette séparation est reflétée par deux modèles
// distincts et deux étapes distinctes du workflow — voir
// docs/SERVICE-REQUESTS.md.

export class ServiceRequestNotFoundError extends Error {
  constructor() {
    super("Demande introuvable.");
    this.name = "ServiceRequestNotFoundError";
  }
}

export class ServiceRequestConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceRequestConflictError";
  }
}

// Chaque transaction ci-dessous peut faire plusieurs aller-retours réseau
// vers Neon (us-west-2) — même choix que Phase 2.5 pour éviter le P2028
// rencontré sur les transactions véhicule.
const TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 10_000 };

const SERVICE_REQUEST_INCLUDE = {
  vehicle: true,
  location: true,
  attachments: { orderBy: { createdAt: "asc" as const } },
  appointment: { include: { location: true } },
} satisfies Prisma.ServiceRequestInclude;

// Transitions autorisées — contrôlées uniquement côté serveur (jamais par le
// frontend). Toute tentative hors de cette table lève ServiceRequestConflictError.
const ALLOWED_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED", "RESCHEDULE_REQUESTED", "CANCELLED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "RESCHEDULE_REQUESTED", "CANCELLED"],
  RESCHEDULE_REQUESTED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["CANCELLED", "COMPLETED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
};

function assertTransition(current: ServiceRequestStatus, target: ServiceRequestStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new ServiceRequestConflictError(
      `Transition impossible : une demande ${current} ne peut pas passer à ${target}.`
    );
  }
}

export async function createServiceRequest(customerId: string, input: CreateServiceRequestInput) {
  const vehicle = await getVehicleForCustomer(customerId, input.vehicleId);
  if (vehicle.status !== "ACTIVE") {
    throw new VehicleConflictError("Ce véhicule est archivé et ne peut pas faire l'objet d'une nouvelle demande.");
  }

  const serviceRequest = await db.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        referenceNumber: `pending-${randomUUID()}`,
        customerId,
        vehicleId: input.vehicleId,
        category: input.category,
        description: input.description,
        interventionType: input.interventionType,
        isUrgent: input.isUrgent,
        urgencyReason: input.urgencyReason ?? null,
        urgencyDescription: input.urgencyDescription || null,
        preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
        preferredSlot: input.preferredSlot ?? null,
        status: "SUBMITTED",
      },
    });

    const withReference = await tx.serviceRequest.update({
      where: { id: created.id },
      data: { referenceNumber: formatServiceRequestReference(created.sequenceNumber) },
    });

    if (input.interventionType === "MOBILE" && input.location) {
      await tx.requestLocation.create({
        data: {
          serviceRequestId: withReference.id,
          latitude: input.location.latitude ?? null,
          longitude: input.location.longitude ?? null,
          accuracy: input.location.accuracy ?? null,
          address: input.location.address || null,
          city: input.location.city || null,
          district: input.location.district || null,
          commune: input.location.commune || null,
          neighborhood: input.location.neighborhood || null,
          landmark: input.location.landmark || null,
          locationSource: input.location.locationSource,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: null,
        action: "SERVICE_REQUEST_CREATED",
        entity: "ServiceRequest",
        entityId: withReference.id,
        newValue: { referenceNumber: withReference.referenceNumber, category: withReference.category },
      },
    });

    return withReference;
  }, TRANSACTION_OPTIONS);

  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "REQUEST_RECEIVED", { reference: serviceRequest.referenceNumber });
  }

  return getServiceRequestForCustomer(customerId, serviceRequest.id);
}

export function listServiceRequestsForCustomer(customerId: string) {
  return db.serviceRequest.findMany({
    where: { customerId },
    include: SERVICE_REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getServiceRequestForCustomer(customerId: string, id: string) {
  const request = await db.serviceRequest.findFirst({
    where: { id, customerId },
    include: SERVICE_REQUEST_INCLUDE,
  });
  if (!request) throw new ServiceRequestNotFoundError();
  return request;
}

export async function cancelServiceRequest(customerId: string, id: string) {
  const existing = await db.serviceRequest.findFirst({ where: { id, customerId } });
  if (!existing) throw new ServiceRequestNotFoundError();
  assertTransition(existing.status, "CANCELLED");

  return db.$transaction(async (tx) => {
    const cancelled = await tx.serviceRequest.update({ where: { id }, data: { status: "CANCELLED" } });

    const appointment = await tx.appointment.findUnique({ where: { serviceRequestId: id } });
    if (appointment && appointment.status !== "CANCELLED" && appointment.status !== "COMPLETED") {
      await tx.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
    }

    await tx.auditLog.create({
      data: { action: "SERVICE_REQUEST_CANCELLED", entity: "ServiceRequest", entityId: id },
    });

    return cancelled;
  }, TRANSACTION_OPTIONS);
}

// ============================================================
// PRODUCTION — accès non filtré par ownership, gardé par RBAC au niveau des
// routes API (requireProductionRole, src/lib/rbac.ts).
// ============================================================

export interface ProductionFilters {
  status?: ServiceRequestStatus;
  isUrgent?: boolean;
  interventionType?: "AT_GARAGE" | "MOBILE";
}

export function listServiceRequestsForProduction(filters: ProductionFilters = {}) {
  return db.serviceRequest.findMany({
    where: {
      status: filters.status,
      isUrgent: filters.isUrgent,
      interventionType: filters.interventionType,
    },
    include: {
      ...SERVICE_REQUEST_INCLUDE,
      customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
    },
    orderBy: [{ isUrgent: "desc" }, { createdAt: "asc" }],
  });
}

export async function getServiceRequestForProduction(id: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id },
    include: {
      ...SERVICE_REQUEST_INCLUDE,
      customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
    },
  });
  if (!request) throw new ServiceRequestNotFoundError();
  return request;
}

export async function acceptServiceRequest(
  id: string,
  input: { scheduledDate: string; scheduledSlot: string; notes?: string }
) {
  const existing = await db.serviceRequest.findUnique({
    where: { id },
    include: { location: true },
  });
  if (!existing) throw new ServiceRequestNotFoundError();
  assertTransition(existing.status, "ACCEPTED");

  const result = await db.$transaction(async (tx) => {
    const accepted = await tx.serviceRequest.update({ where: { id }, data: { status: "ACCEPTED" } });

    const appointment = await tx.appointment.upsert({
      where: { serviceRequestId: id },
      create: {
        serviceRequestId: id,
        customerId: existing.customerId,
        vehicleId: existing.vehicleId,
        scheduledDate: new Date(input.scheduledDate),
        scheduledSlot: input.scheduledSlot,
        interventionType: existing.interventionType,
        status: "ACCEPTED",
        notes: input.notes || null,
        acceptedAt: new Date(),
      },
      update: {
        scheduledDate: new Date(input.scheduledDate),
        scheduledSlot: input.scheduledSlot,
        status: "ACCEPTED",
        notes: input.notes || null,
        acceptedAt: new Date(),
      },
    });

    if (existing.interventionType === "MOBILE" && existing.location) {
      await tx.appointmentLocation.upsert({
        where: { appointmentId: appointment.id },
        create: {
          appointmentId: appointment.id,
          latitude: existing.location.latitude,
          longitude: existing.location.longitude,
          accuracy: existing.location.accuracy,
          address: existing.location.address,
          city: existing.location.city,
          district: existing.location.district,
          commune: existing.location.commune,
          neighborhood: existing.location.neighborhood,
          landmark: existing.location.landmark,
          locationSource: existing.location.locationSource,
        },
        update: {},
      });
    }

    await tx.auditLog.create({
      data: { action: "SERVICE_REQUEST_ACCEPTED", entity: "ServiceRequest", entityId: id },
    });

    return { accepted, appointment };
  }, TRANSACTION_OPTIONS);

  const customer = await db.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
  const vehicle = await db.vehicle.findUnique({ where: { id: existing.vehicleId }, select: { make: true, model: true } });
  if (customer) {
    await sendNotification(customer.userId, "REQUEST_ACCEPTED", {
      reference: result.accepted.referenceNumber,
      vehicle: vehicle ? `${vehicle.make} ${vehicle.model}` : "",
      date: input.scheduledDate,
      slot: input.scheduledSlot,
    });
  }

  return getServiceRequestForProduction(id);
}

export async function rejectServiceRequest(id: string, reason?: string) {
  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) throw new ServiceRequestNotFoundError();
  assertTransition(existing.status, "REJECTED");

  // Forme "batch" du $transaction : les requêtes indépendantes sont envoyées
  // groupées en une seule requête réseau, pas de transaction interactive
  // maintenue ouverte — les options timeout/maxWait ne s'appliquent qu'à la
  // forme callback (voir TRANSACTION_OPTIONS plus haut) et ne sont pas
  // nécessaires ici.
  await db.$transaction([
    db.serviceRequest.update({ where: { id }, data: { status: "REJECTED" } }),
    db.auditLog.create({
      data: { action: "SERVICE_REQUEST_REJECTED", entity: "ServiceRequest", entityId: id, newValue: { reason } },
    }),
  ]);

  const customer = await db.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "REQUEST_REJECTED", {
      reference: existing.referenceNumber,
      reason: reason ? ` Motif : ${reason}` : "",
    });
  }

  return getServiceRequestForProduction(id);
}

export async function requestReschedule(
  id: string,
  input: { scheduledDate: string; scheduledSlot: string; notes?: string }
) {
  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) throw new ServiceRequestNotFoundError();
  assertTransition(existing.status, "RESCHEDULE_REQUESTED");

  await db.$transaction(async (tx) => {
    await tx.serviceRequest.update({ where: { id }, data: { status: "RESCHEDULE_REQUESTED" } });
    await tx.appointment.upsert({
      where: { serviceRequestId: id },
      create: {
        serviceRequestId: id,
        customerId: existing.customerId,
        vehicleId: existing.vehicleId,
        scheduledDate: new Date(input.scheduledDate),
        scheduledSlot: input.scheduledSlot,
        interventionType: existing.interventionType,
        status: "RESCHEDULE_REQUESTED",
        notes: input.notes || null,
      },
      update: {
        scheduledDate: new Date(input.scheduledDate),
        scheduledSlot: input.scheduledSlot,
        status: "RESCHEDULE_REQUESTED",
        notes: input.notes || null,
      },
    });
    await tx.auditLog.create({
      data: { action: "SERVICE_REQUEST_RESCHEDULE_REQUESTED", entity: "ServiceRequest", entityId: id },
    });
  }, TRANSACTION_OPTIONS);

  const customer = await db.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "RESCHEDULE_REQUESTED", {
      reference: existing.referenceNumber,
      date: input.scheduledDate,
      slot: input.scheduledSlot,
    });
  }

  return getServiceRequestForProduction(id);
}

// Fait passer une demande en qualification (section "Kanban" de la Phase 4 —
// colonne intermédiaire entre "nouvelle demande" et la décision
// accepter/refuser). Optionnel dans le flux : accept/reject restent
// directement utilisables depuis SUBMITTED (voir ALLOWED_TRANSITIONS).
export async function markUnderReview(id: string) {
  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) throw new ServiceRequestNotFoundError();
  assertTransition(existing.status, "UNDER_REVIEW");

  await db.$transaction([
    db.serviceRequest.update({ where: { id }, data: { status: "UNDER_REVIEW" } }),
    db.auditLog.create({
      data: { action: "SERVICE_REQUEST_UNDER_REVIEW", entity: "ServiceRequest", entityId: id },
    }),
  ]);

  return getServiceRequestForProduction(id);
}

// Clôture administrative d'une demande acceptée (colonne "Terminées" du
// Kanban Phase 4). Ne prétend pas qu'un diagnostic ou une réparation a été
// effectué — hors périmètre tant que ces modules ne sont pas construits
// (voir docs/SERVICE-REQUESTS.md) ; ferme simplement le cycle
// demande → rendez-vous une fois l'intervention terminée sur le terrain.
export async function completeServiceRequest(id: string) {
  const existing = await db.serviceRequest.findUnique({ where: { id } });
  if (!existing) throw new ServiceRequestNotFoundError();
  assertTransition(existing.status, "COMPLETED");

  return db.$transaction(async (tx) => {
    const completed = await tx.serviceRequest.update({ where: { id }, data: { status: "COMPLETED" } });

    const appointment = await tx.appointment.findUnique({ where: { serviceRequestId: id } });
    if (appointment) {
      await tx.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
    }

    await tx.auditLog.create({
      data: { action: "SERVICE_REQUEST_COMPLETED", entity: "ServiceRequest", entityId: id },
    });

    return completed;
  }, TRANSACTION_OPTIONS);
}

export async function addServiceRequestAttachment(
  customerId: string,
  serviceRequestId: string,
  attachment: { url: string; type: string }
) {
  const existing = await db.serviceRequest.findFirst({ where: { id: serviceRequestId, customerId } });
  if (!existing) throw new ServiceRequestNotFoundError();

  return db.serviceRequestAttachment.create({
    data: { serviceRequestId, url: attachment.url, type: attachment.type },
  });
}
