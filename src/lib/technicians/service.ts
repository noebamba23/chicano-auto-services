import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import type { Prisma } from "@prisma/client";

// Affectation technicien "basique" (Phase 4) — prépare Technician/
// TechnicianAssignment pour la phase technicien complète à venir, sans
// construire l'application technicien elle-même (section "TECHNICIENS" du
// prompt Phase 3, reconduite en Phase 4 : "la Phase 3 peut permettre à la
// production de préparer une affectation, mais le workflow technicien
// complet sera développé dans une phase ultérieure").

export class TechnicianConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnicianConflictError";
  }
}

// Distinct de TechnicianConflictError (409, transition/état invalide) —
// une intervention introuvable OU appartenant à un autre technicien se
// comporte comme une intervention inexistante (404), jamais un 403
// révélateur (même discipline que docs/VEHICLES.md et
// docs/SERVICE-REQUESTS.md).
export class AssignmentNotFoundError extends Error {
  constructor() {
    super("Intervention introuvable.");
    this.name = "AssignmentNotFoundError";
  }
}

const TECHNICIAN_INCLUDE = {
  user: { select: { firstName: true, lastName: true, phoneE164: true } },
} satisfies Prisma.TechnicianInclude;

const ASSIGNMENT_INCLUDE = {
  appointment: {
    include: {
      serviceRequest: { select: { referenceNumber: true, category: true, isUrgent: true } },
      vehicle: { select: { make: true, model: true, chicanoVehicleId: true } },
      customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } },
      location: true,
      diagnostics: { orderBy: { startedAt: "desc" as const }, take: 1 },
    },
  },
} satisfies Prisma.TechnicianAssignmentInclude;

export function listTechnicians() {
  return db.technician.findMany({
    include: TECHNICIAN_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

export function getActiveAssignmentForAppointment(appointmentId: string) {
  return db.technicianAssignment.findFirst({
    where: { appointmentId, status: { not: "REASSIGNED" } },
    include: { technician: { include: TECHNICIAN_INCLUDE } },
    orderBy: { createdAt: "desc" },
  });
}

export async function assignTechnician(serviceRequestId: string, technicianId: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: { appointment: true },
  });
  if (!request?.appointment) {
    throw new TechnicianConflictError("Cette demande n'a pas encore de rendez-vous confirmé.");
  }

  const technician = await db.technician.findUnique({ where: { id: technicianId } });
  if (!technician) throw new TechnicianConflictError("Technicien introuvable.");

  const appointment = request.appointment;

  // Empêche la double réservation d'un même technicien sur le même
  // date+créneau (section "CALENDRIER" : "empêcher les doubles réservations")
  // — au niveau du technicien plutôt que du créneau global, puisque
  // plusieurs interventions différentes peuvent légitimement partager un
  // créneau tant qu'elles sont assurées par des techniciens distincts.
  if (appointment.scheduledDate && appointment.scheduledSlot) {
    const conflict = await db.technicianAssignment.findFirst({
      where: {
        technicianId,
        status: { not: "REASSIGNED" },
        appointment: {
          scheduledDate: appointment.scheduledDate,
          scheduledSlot: appointment.scheduledSlot,
          id: { not: appointment.id },
        },
      },
    });
    if (conflict) {
      throw new TechnicianConflictError(
        "Ce technicien a déjà une intervention sur ce créneau."
      );
    }
  }

  const assignment = await db.$transaction(async (tx) => {
    // Un technicien précédemment affecté à ce rendez-vous est marqué
    // REASSIGNED plutôt que supprimé — conserve l'historique des
    // affectations (section "HISTORIQUE").
    await tx.technicianAssignment.updateMany({
      where: { appointmentId: appointment.id, status: { not: "REASSIGNED" } },
      data: { status: "REASSIGNED" },
    });

    const created = await tx.technicianAssignment.create({
      data: { appointmentId: appointment.id, technicianId, status: "ASSIGNED" },
    });

    await tx.appointment.update({ where: { id: appointment.id }, data: { status: "ASSIGNED" } });

    await tx.auditLog.create({
      data: {
        action: "TECHNICIAN_ASSIGNED",
        entity: "Appointment",
        entityId: appointment.id,
        newValue: { technicianId },
      },
    });

    return created;
  });

  const customer = await db.customer.findUnique({ where: { id: request.customerId }, select: { userId: true } });
  if (customer) {
    await sendNotification(customer.userId, "TECHNICIAN_ASSIGNED", {});
  }

  return assignment;
}

// ============================================================
// ESPACE TECHNICIEN (Phase 5) — accès filtré par ownership : un technicien ne
// voit et n'agit que sur SES propres affectations (jamais celles d'un autre
// technicien), même discipline "404 plutôt que 403" que le reste de la
// plateforme.
// ============================================================

export async function getTechnicianIdForUser(userId: string): Promise<string | null> {
  const technician = await db.technician.findUnique({ where: { userId }, select: { id: true } });
  return technician?.id ?? null;
}

export function listAssignmentsForTechnician(technicianId: string) {
  return db.technicianAssignment.findMany({
    where: { technicianId, status: { not: "REASSIGNED" } },
    include: ASSIGNMENT_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

export async function getAssignmentForTechnician(technicianId: string, assignmentId: string) {
  const assignment = await db.technicianAssignment.findFirst({
    where: { id: assignmentId, technicianId, status: { not: "REASSIGNED" } },
    include: ASSIGNMENT_INCLUDE,
  });
  if (!assignment) throw new AssignmentNotFoundError();
  return assignment;
}

// "Je pars" — déclenche TECHNICIAN_EN_ROUTE côté Appointment (statut distinct
// du ServiceRequest, qui reste ACCEPTED tant que la production ne clôture pas
// explicitement — voir la note sur completeServiceRequest dans
// service-requests/service.ts). ASSIGNED → EN_ROUTE uniquement.
export async function departForAssignment(technicianId: string, assignmentId: string) {
  const assignment = await getAssignmentForTechnician(technicianId, assignmentId);
  if (assignment.status !== "ASSIGNED") {
    throw new TechnicianConflictError('Cette intervention n\'est pas au statut "Affectée".');
  }

  const [updated] = await db.$transaction([
    db.technicianAssignment.update({
      where: { id: assignmentId },
      data: { status: "EN_ROUTE", departedAt: new Date() },
    }),
    db.appointment.update({ where: { id: assignment.appointmentId }, data: { status: "TECHNICIAN_EN_ROUTE" } }),
    db.auditLog.create({
      data: { action: "TECHNICIAN_EN_ROUTE", entity: "Appointment", entityId: assignment.appointmentId },
    }),
  ]);

  if (assignment.appointment.customer) {
    await sendNotification(assignment.appointment.customer.userId, "TECHNICIAN_EN_ROUTE", {});
  }

  return updated;
}

// "Je suis arrivé" — EN_ROUTE → ARRIVED uniquement. Débloque le démarrage du
// diagnostic (startDiagnostic() dans src/lib/diagnostics/service.ts exige ce
// statut, cf. section "PHASE 5" de docs/TECHNICIAN-APP.md).
export async function arriveForAssignment(technicianId: string, assignmentId: string) {
  const assignment = await getAssignmentForTechnician(technicianId, assignmentId);
  if (assignment.status !== "EN_ROUTE") {
    throw new TechnicianConflictError('Cette intervention n\'est pas au statut "En route".');
  }

  const [updated] = await db.$transaction([
    db.technicianAssignment.update({
      where: { id: assignmentId },
      data: { status: "ARRIVED", arrivedAt: new Date() },
    }),
    db.appointment.update({ where: { id: assignment.appointmentId }, data: { status: "ARRIVED" } }),
    db.auditLog.create({
      data: { action: "TECHNICIAN_ARRIVED", entity: "Appointment", entityId: assignment.appointmentId },
    }),
  ]);

  if (assignment.appointment.customer) {
    await sendNotification(assignment.appointment.customer.userId, "TECHNICIAN_ARRIVED", {});
  }

  return updated;
}
