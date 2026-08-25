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

const TECHNICIAN_INCLUDE = {
  user: { select: { firstName: true, lastName: true, phoneE164: true } },
} satisfies Prisma.TechnicianInclude;

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
