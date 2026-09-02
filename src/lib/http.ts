import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError, UnverifiedAccountError } from "@/lib/vehicles/guard";
import { VehicleNotFoundError, VehicleConflictError } from "@/lib/vehicles/service";
import { InvalidPlateFormatError } from "@/lib/vehicles/registration/plate";
import { ForbiddenRoleError } from "@/lib/rbac";
import {
  ServiceRequestNotFoundError,
  ServiceRequestConflictError,
} from "@/lib/service-requests/service";
import { TechnicianConflictError, AssignmentNotFoundError } from "@/lib/technicians/service";
import { ForbiddenTechnicianRoleError } from "@/lib/technicians/guard";
import { DiagnosticNotFoundError, DiagnosticConflictError } from "@/lib/diagnostics/service";
import { ReportNotFoundError, ReportConflictError } from "@/lib/reports/service";
import { QuoteNotFoundError, QuoteConflictError } from "@/lib/quotes/service";
import { WorkOrderNotFoundError, WorkOrderConflictError } from "@/lib/work-orders/service";
import {
  MaintenancePlanNotFoundError,
  MaintenanceReminderNotFoundError,
  MaintenanceConflictError,
} from "@/lib/maintenance/service";
import { MileageRegressionError } from "@/lib/vehicles/mileage";
import { InvoiceNotFoundError, InvoiceConflictError, PaymentValidationError } from "@/lib/billing/service";
import {
  CustomerNotFoundError,
  CampaignNotFoundError,
  CampaignConflictError,
  CarePlanNotFoundError,
  CareSubscriptionNotFoundError,
  CareConflictError,
  FollowUpNotFoundError,
  FollowUpConflictError,
  ReferralConflictError,
  ConsentError,
} from "@/lib/crm/errors";

// Catalogue d'erreurs HTTP de l'API (section 13 de la Phase 2) :
//   400 Données invalides         — payload rejeté par un schéma zod
//   401 Non authentifié           — pas de session valide
//   403 Accès interdit            — authentifié mais compte non vérifié
//   404 Véhicule introuvable      — inexistant OU appartenant à un autre client
//                                    (délibérément fusionnés : ne jamais confirmer
//                                    l'existence d'un véhicule qui n'appartient pas
//                                    à l'appelant — voir docs/VEHICLES.md)
//   409 Conflit métier            — véhicule possédé mais dans un état incompatible
//                                    avec l'opération (ex. déjà archivé)
//   500 Erreur serveur            — jamais la stack Prisma brute exposée au client

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromZodError(error: ZodError) {
  const flattened = error.flatten((issue) => issue.message);
  const firstIssue = error.issues[0];
  return NextResponse.json(
    {
      error: firstIssue?.message ?? "Données invalides.",
      fieldErrors: flattened.fieldErrors,
    },
    { status: 400 }
  );
}

// Traduit les erreurs métier connues des routes API véhicules en réponses
// HTTP cohérentes. Retourne null si l'erreur n'est pas reconnue (l'appelant
// doit alors logger et répondre 500) — jamais la stack Prisma brute exposée
// au client.
export function jsonFromKnownError(err: unknown) {
  if (err instanceof ZodError) return jsonFromZodError(err);
  if (err instanceof UnauthenticatedError) return jsonError(err.message, 401);
  if (err instanceof UnverifiedAccountError) return jsonError(err.message, 403);
  if (err instanceof VehicleNotFoundError) return jsonError(err.message, 404);
  if (err instanceof VehicleConflictError) return jsonError(err.message, 409);
  if (err instanceof InvalidPlateFormatError) return jsonError(err.message, 400);
  if (err instanceof ForbiddenRoleError) return jsonError(err.message, 403);
  if (err instanceof ServiceRequestNotFoundError) return jsonError(err.message, 404);
  if (err instanceof ServiceRequestConflictError) return jsonError(err.message, 409);
  if (err instanceof TechnicianConflictError) return jsonError(err.message, 409);
  if (err instanceof AssignmentNotFoundError) return jsonError(err.message, 404);
  if (err instanceof ForbiddenTechnicianRoleError) return jsonError(err.message, 403);
  if (err instanceof DiagnosticNotFoundError) return jsonError(err.message, 404);
  if (err instanceof DiagnosticConflictError) return jsonError(err.message, 409);
  if (err instanceof ReportNotFoundError) return jsonError(err.message, 404);
  if (err instanceof ReportConflictError) return jsonError(err.message, 409);
  if (err instanceof QuoteNotFoundError) return jsonError(err.message, 404);
  if (err instanceof QuoteConflictError) return jsonError(err.message, 409);
  if (err instanceof WorkOrderNotFoundError) return jsonError(err.message, 404);
  if (err instanceof WorkOrderConflictError) return jsonError(err.message, 409);
  if (err instanceof MaintenancePlanNotFoundError) return jsonError(err.message, 404);
  if (err instanceof MaintenanceReminderNotFoundError) return jsonError(err.message, 404);
  if (err instanceof MaintenanceConflictError) return jsonError(err.message, 409);
  if (err instanceof MileageRegressionError) return jsonError(err.message, 409);
  // Facturation (Phase 9) — absentes du catalogue par omission jusqu'ici
  // (repassaient en 500 générique), corrigé à l'occasion de la Phase 10.
  if (err instanceof InvoiceNotFoundError) return jsonError(err.message, 404);
  if (err instanceof InvoiceConflictError) return jsonError(err.message, 409);
  if (err instanceof PaymentValidationError) return jsonError(err.message, 400);
  // CRM & CHICANO CARE (Phase 10).
  if (err instanceof CustomerNotFoundError) return jsonError(err.message, 404);
  if (err instanceof CampaignNotFoundError) return jsonError(err.message, 404);
  if (err instanceof CampaignConflictError) return jsonError(err.message, 409);
  if (err instanceof CarePlanNotFoundError) return jsonError(err.message, 404);
  if (err instanceof CareSubscriptionNotFoundError) return jsonError(err.message, 404);
  if (err instanceof CareConflictError) return jsonError(err.message, 409);
  if (err instanceof FollowUpNotFoundError) return jsonError(err.message, 404);
  if (err instanceof FollowUpConflictError) return jsonError(err.message, 409);
  if (err instanceof ReferralConflictError) return jsonError(err.message, 409);
  if (err instanceof ConsentError) return jsonError(err.message, 409);
  return null;
}

export function jsonApiErrorResponse(err: unknown) {
  const known = jsonFromKnownError(err);
  if (known) return known;
  console.error(err);
  return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
}
