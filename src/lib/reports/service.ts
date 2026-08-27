import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { formatReportReference } from "./reference";
import { sendNotification } from "@/lib/notifications/service";
import type { Prisma, SeverityLevel } from "@prisma/client";

// Rapport de diagnostic (Phase 6) — s'appuie sur les données capturées en
// Phase 5 (Diagnostic/DiagnosticCheck/DiagnosticFaultCode), jamais construit
// avant que le diagnostic soit COMPLETED. Un rapport à l'état "brouillon"
// (publishedAt = null) n'est JAMAIS visible côté client — c'est la version
// publiée qui fait foi (section "preuve" de la philosophie CHICANO :
// diagnostiquer avant de réparer). Une fois publié, le rapport est figé :
// aucune modification n'est plus possible (le client doit pouvoir s'y fier).

export class ReportNotFoundError extends Error {
  constructor() {
    super("Rapport introuvable.");
    this.name = "ReportNotFoundError";
  }
}

export class ReportConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportConflictError";
  }
}

const REPORT_INCLUDE = {
  photos: true,
  diagnostic: {
    select: {
      id: true,
      symptoms: true,
      mileageAtVisit: true,
      checks: true,
      faultCodes: true,
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          chicanoVehicleId: true,
          licensePlate: true,
          vin: true,
          customerId: true,
        },
      },
      appointment: { select: { serviceRequest: { select: { referenceNumber: true } } } },
    },
  },
} satisfies Prisma.DiagnosticReportInclude;

function assertEditable(report: { publishedAt: Date | null }) {
  if (report.publishedAt) {
    throw new ReportConflictError("Ce rapport est déjà publié et ne peut plus être modifié.");
  }
}

// Idempotent, même principe que startDiagnostic() : un second appel sur le
// même diagnostic retourne le brouillon déjà créé plutôt que d'en dupliquer un
// (DiagnosticReport.diagnosticId est unique de toute façon, mais évite un
// aller-retour d'erreur inutile côté UI production).
export async function getOrCreateDraftReport(diagnosticId: string) {
  const diagnostic = await db.diagnostic.findUnique({ where: { id: diagnosticId } });
  if (!diagnostic) throw new ReportNotFoundError();
  if (diagnostic.status !== "COMPLETED") {
    throw new ReportConflictError("Le diagnostic doit être terminé avant de créer un rapport.");
  }

  const existing = await db.diagnosticReport.findUnique({ where: { diagnosticId }, include: REPORT_INCLUDE });
  if (existing) return existing;

  const created = await db.diagnosticReport.create({
    data: { diagnosticId, reportNumber: `pending-${randomUUID()}` },
  });
  const withReference = await db.diagnosticReport.update({
    where: { id: created.id },
    data: { reportNumber: formatReportReference(created.sequenceNumber) },
  });

  await db.auditLog.create({
    data: { action: "REPORT_DRAFT_CREATED", entity: "DiagnosticReport", entityId: withReference.id },
  });

  return getReportForProduction(withReference.id);
}

export async function getReportForProduction(reportId: string) {
  const report = await db.diagnosticReport.findUnique({ where: { id: reportId }, include: REPORT_INCLUDE });
  if (!report) throw new ReportNotFoundError();
  return report;
}

export function getReportByDiagnostic(diagnosticId: string) {
  return db.diagnosticReport.findUnique({ where: { diagnosticId }, include: REPORT_INCLUDE });
}

export async function updateReportDraft(
  reportId: string,
  input: { conclusion?: string; severity?: SeverityLevel }
) {
  const report = await getReportForProduction(reportId);
  assertEditable(report);

  await db.diagnosticReport.update({
    where: { id: reportId },
    data: { conclusion: input.conclusion, severity: input.severity },
  });

  return getReportForProduction(reportId);
}

export async function addReportPhoto(reportId: string, input: { url: string; caption?: string }) {
  const report = await getReportForProduction(reportId);
  assertEditable(report);

  await db.reportPhoto.create({ data: { reportId, url: input.url, caption: input.caption || null } });
  return getReportForProduction(reportId);
}

export async function removeReportPhoto(reportId: string, photoId: string) {
  const report = await getReportForProduction(reportId);
  assertEditable(report);

  const target = report.photos.find((p) => p.id === photoId);
  if (!target) throw new ReportNotFoundError();

  await db.reportPhoto.delete({ where: { id: photoId } });
  return getReportForProduction(reportId);
}

export async function publishReport(reportId: string, publishedById: string) {
  const report = await getReportForProduction(reportId);
  assertEditable(report);

  await db.diagnosticReport.update({
    where: { id: reportId },
    data: { publishedAt: new Date(), publishedById },
  });

  await db.auditLog.create({
    data: { action: "REPORT_PUBLISHED", entity: "DiagnosticReport", entityId: reportId },
  });

  const customer = await db.customer.findUnique({
    where: { id: report.diagnostic.vehicle.customerId },
    select: { userId: true },
  });
  if (customer) {
    await sendNotification(customer.userId, "REPORT_AVAILABLE", {});
  }

  return getReportForProduction(reportId);
}

// ============================================================
// ESPACE CLIENT — un rapport non publié se comporte comme inexistant
// (jamais de brouillon exposé), même discipline ownership 404 que le reste
// de la plateforme.
// ============================================================

export function listPublishedReportsForCustomer(customerId: string) {
  return db.diagnosticReport.findMany({
    where: { publishedAt: { not: null }, diagnostic: { vehicle: { customerId } } },
    include: REPORT_INCLUDE,
    orderBy: { publishedAt: "desc" },
  });
}

export async function getPublishedReportForCustomer(customerId: string, reportId: string) {
  const report = await db.diagnosticReport.findFirst({
    where: { id: reportId, publishedAt: { not: null }, diagnostic: { vehicle: { customerId } } },
    include: REPORT_INCLUDE,
  });
  if (!report) throw new ReportNotFoundError();
  return report;
}
