import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { getAssignmentForTechnician } from "@/lib/technicians/service";
import type { CheckCategory, CheckResult, Prisma } from "@prisma/client";

// Diagnostic terrain (Phase 5) — capture brute (checklist + codes défaut +
// kilométrage/symptômes) effectuée par le technicien sur place, une fois le
// statut "Arrivé" atteint (voir departForAssignment/arriveForAssignment dans
// src/lib/technicians/service.ts). Ne construit PAS encore le rapport client
// formaté ni les photos de preuve (DiagnosticReport/ReportPhoto, déjà posés
// au schéma) : ce sera la Phase 6 ("Rapport + devis"), qui s'appuiera sur ces
// données. Voir docs/TECHNICIAN-APP.md.

export class DiagnosticNotFoundError extends Error {
  constructor() {
    super("Diagnostic introuvable.");
    this.name = "DiagnosticNotFoundError";
  }
}

export class DiagnosticConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiagnosticConflictError";
  }
}

const DIAGNOSTIC_INCLUDE = {
  checks: true,
  faultCodes: { orderBy: { createdAt: "asc" as const } },
  vehicle: {
    select: {
      make: true,
      model: true,
      chicanoVehicleId: true,
      licensePlate: true,
      vin: true,
      year: true,
    },
  },
  appointment: {
    select: { id: true, serviceRequest: { select: { referenceNumber: true } } },
  },
} satisfies Prisma.DiagnosticInclude;

// Idempotent : si un diagnostic existe déjà pour ce rendez-vous et ce
// technicien (ex. rafraîchissement de page après un premier démarrage), le
// retourne tel quel plutôt que d'en créer un second.
export async function startDiagnostic(
  technicianId: string,
  assignmentId: string,
  input: { mileageAtVisit?: number; symptoms?: string }
) {
  const assignment = await getAssignmentForTechnician(technicianId, assignmentId);
  if (assignment.status !== "ARRIVED") {
    throw new DiagnosticConflictError('Le diagnostic ne peut démarrer qu\'une fois le statut "Arrivé" atteint.');
  }

  const existing = await db.diagnostic.findFirst({
    where: { appointmentId: assignment.appointmentId, technicianId },
    include: DIAGNOSTIC_INCLUDE,
  });
  if (existing) return existing;

  const created = await db.$transaction(async (tx) => {
    const diagnostic = await tx.diagnostic.create({
      data: {
        appointmentId: assignment.appointmentId,
        vehicleId: assignment.appointment.vehicleId,
        technicianId,
        mileageAtVisit: input.mileageAtVisit ?? null,
        symptoms: input.symptoms || null,
        status: "IN_PROGRESS",
      },
    });

    await tx.appointment.update({ where: { id: assignment.appointmentId }, data: { status: "IN_PROGRESS" } });

    await tx.auditLog.create({
      data: { action: "DIAGNOSTIC_STARTED", entity: "Diagnostic", entityId: diagnostic.id },
    });

    return diagnostic;
  });

  return getDiagnosticForTechnician(technicianId, created.id);
}

export async function getDiagnosticForTechnician(technicianId: string, diagnosticId: string) {
  const diagnostic = await db.diagnostic.findFirst({
    where: { id: diagnosticId, technicianId },
    include: DIAGNOSTIC_INCLUDE,
  });
  if (!diagnostic) throw new DiagnosticNotFoundError();
  return diagnostic;
}

export async function upsertDiagnosticCheck(
  technicianId: string,
  diagnosticId: string,
  input: { category: CheckCategory; result: CheckResult; observation?: string }
) {
  const diagnostic = await getDiagnosticForTechnician(technicianId, diagnosticId);
  if (diagnostic.status !== "IN_PROGRESS") {
    throw new DiagnosticConflictError("Ce diagnostic est déjà terminé, il ne peut plus être modifié.");
  }

  await db.diagnosticCheck.upsert({
    where: { diagnosticId_category: { diagnosticId, category: input.category } },
    create: { diagnosticId, category: input.category, result: input.result, observation: input.observation || null },
    update: { result: input.result, observation: input.observation || null },
  });

  return getDiagnosticForTechnician(technicianId, diagnosticId);
}

export async function addFaultCode(
  technicianId: string,
  diagnosticId: string,
  input: {
    device?: string;
    deviceBrand?: string;
    deviceModel?: string;
    system?: string;
    code: string;
    description?: string;
    measurement?: string;
    observation?: string;
    recommendation?: string;
  }
) {
  const diagnostic = await getDiagnosticForTechnician(technicianId, diagnosticId);
  if (diagnostic.status !== "IN_PROGRESS") {
    throw new DiagnosticConflictError("Ce diagnostic est déjà terminé, il ne peut plus être modifié.");
  }

  await db.diagnosticFaultCode.create({
    data: {
      diagnosticId,
      device: input.device || null,
      deviceBrand: input.deviceBrand || null,
      deviceModel: input.deviceModel || null,
      system: input.system || null,
      code: input.code,
      description: input.description || null,
      measurement: input.measurement || null,
      observation: input.observation || null,
      recommendation: input.recommendation || null,
    },
  });

  return getDiagnosticForTechnician(technicianId, diagnosticId);
}

export async function removeFaultCode(technicianId: string, diagnosticId: string, faultCodeId: string) {
  const diagnostic = await getDiagnosticForTechnician(technicianId, diagnosticId);
  if (diagnostic.status !== "IN_PROGRESS") {
    throw new DiagnosticConflictError("Ce diagnostic est déjà terminé, il ne peut plus être modifié.");
  }

  const target = diagnostic.faultCodes.find((f) => f.id === faultCodeId);
  if (!target) throw new DiagnosticNotFoundError();

  await db.diagnosticFaultCode.delete({ where: { id: faultCodeId } });

  return getDiagnosticForTechnician(technicianId, diagnosticId);
}

// Ne modifie jamais Appointment.status ici : la clôture du terrain
// (réparation, validation client, facturation) appartient aux phases
// suivantes — un diagnostic COMPLETED signifie "constat terminé", pas
// "intervention terminée" (voir docs/TECHNICIAN-APP.md, section "Non
// couvert").
export async function completeDiagnostic(
  technicianId: string,
  diagnosticId: string,
  input: { mileageAtVisit?: number; symptoms?: string } = {}
) {
  const diagnostic = await getDiagnosticForTechnician(technicianId, diagnosticId);
  if (diagnostic.status !== "IN_PROGRESS") {
    throw new DiagnosticConflictError("Ce diagnostic est déjà terminé.");
  }

  await db.$transaction([
    db.diagnostic.update({
      where: { id: diagnosticId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        mileageAtVisit: input.mileageAtVisit ?? diagnostic.mileageAtVisit,
        symptoms: input.symptoms || diagnostic.symptoms,
      },
    }),
    // Clôt aussi l'affectation terrain (distinct d'Appointment.status, qui
    // reste IN_PROGRESS — voir la note plus haut) : sans ça, l'intervention
    // resterait affichée "Arrivé" indéfiniment dans le tableau de bord du
    // technicien une fois le diagnostic terminé.
    db.technicianAssignment.updateMany({
      where: { appointmentId: diagnostic.appointmentId, technicianId, status: { not: "REASSIGNED" } },
      data: { status: "COMPLETED" },
    }),
    db.auditLog.create({
      data: { action: "DIAGNOSTIC_COMPLETED", entity: "Diagnostic", entityId: diagnosticId },
    }),
  ]);

  const appointment = await db.appointment.findUnique({
    where: { id: diagnostic.appointmentId },
    select: { customerId: true },
  });
  if (appointment) {
    const customer = await db.customer.findUnique({ where: { id: appointment.customerId }, select: { userId: true } });
    if (customer) {
      await sendNotification(customer.userId, "DIAGNOSTIC_COMPLETED", {});
    }
  }

  return getDiagnosticForTechnician(technicianId, diagnosticId);
}

// ============================================================
// PRODUCTION — visibilité en lecture seule (aucune ownership technicien),
// gardée par RBAC au niveau de la page/route appelante (requireProductionRole).
// ============================================================

export function getLatestDiagnosticForAppointment(appointmentId: string) {
  return db.diagnostic.findFirst({
    where: { appointmentId },
    include: DIAGNOSTIC_INCLUDE,
    orderBy: { startedAt: "desc" },
  });
}
