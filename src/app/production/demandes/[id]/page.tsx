import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceRequestForProduction, ServiceRequestNotFoundError } from "@/lib/service-requests/service";
import {
  interventionTypeLabel,
  serviceCategoryLabel,
  serviceRequestStatusLabel,
  slotLabel,
  urgencyReasonLabel,
} from "@/lib/service-requests/options";
import { ServiceRequestActions } from "@/components/production/service-request-actions";
import { AssignTechnicianForm } from "@/components/production/assign-technician-form";
import { listTechnicians, getActiveAssignmentForAppointment } from "@/lib/technicians/service";
import { getLatestDiagnosticForAppointment } from "@/lib/diagnostics/service";
import { diagnosticStatusLabel, checkCategoryLabel, checkResultLabel } from "@/lib/diagnostics/options";

export default async function ProductionServiceRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request;
  try {
    request = await getServiceRequestForProduction(id);
  } catch (err) {
    if (err instanceof ServiceRequestNotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/production/demandes" className="text-sm text-white/60 hover:text-white">
        ← Demandes de service
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{request.referenceNumber}</h1>
          <p className="mt-1 text-sm text-white/60">
            {request.customer.user.firstName} {request.customer.user.lastName} — {request.customer.user.phoneE164}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
          {serviceRequestStatusLabel(request.status)}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Véhicule" value={`${request.vehicle.make} ${request.vehicle.model} (${request.vehicle.chicanoVehicleId})`} />
          <Field label="Service" value={serviceCategoryLabel(request.category)} />
          <Field label="Mode d'intervention" value={interventionTypeLabel(request.interventionType)} />
          <Field label="Urgence" value={request.isUrgent ? "🔴 Urgent" : "Non"} />
          {request.urgencyReason && <Field label="Motif urgence" value={urgencyReasonLabel(request.urgencyReason) ?? ""} />}
          {request.preferredDate && (
            <Field
              label="Date souhaitée"
              value={`${new Date(request.preferredDate).toLocaleDateString("fr-FR")} — ${slotLabel(request.preferredSlot) ?? ""}`}
            />
          )}
        </dl>

        <div className="mt-4">
          <p className="text-xs text-white/50">Description</p>
          <p className="mt-1 text-sm">{request.description}</p>
        </div>
        {request.isUrgent && request.urgencyDescription && (
          <div className="mt-4">
            <p className="text-xs text-white/50">Situation d&apos;urgence</p>
            <p className="mt-1 text-sm">{request.urgencyDescription}</p>
          </div>
        )}
        {request.location && (
          <div className="mt-4">
            <p className="text-xs text-white/50">Localisation</p>
            <p className="mt-1 text-sm">
              {[request.location.neighborhood, request.location.commune, request.location.city, request.location.landmark]
                .filter(Boolean)
                .join(", ") || "Position GPS transmise"}
            </p>
            {request.location.latitude && request.location.longitude && (
              <p className="mt-1 text-xs text-white/50">
                {request.location.latitude.toFixed(5)}, {request.location.longitude.toFixed(5)}
              </p>
            )}
          </div>
        )}
      </section>

      {request.appointment && (
        <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Rendez-vous</h2>
          <p className="mt-2 text-sm">
            {request.appointment.scheduledDate
              ? new Date(request.appointment.scheduledDate).toLocaleDateString("fr-FR")
              : "À définir"}{" "}
            — {slotLabel(request.appointment.scheduledSlot) ?? "À définir"}
          </p>
        </section>
      )}

      {request.appointment && (request.status === "ACCEPTED" || request.status === "COMPLETED") && (
        <TechnicianSection appointmentId={request.appointment.id} requestId={request.id} />
      )}

      {request.appointment && <DiagnosticSection appointmentId={request.appointment.id} />}

      <div className="mt-6">
        <ServiceRequestActions requestId={request.id} status={request.status} />
      </div>
    </div>
  );
}

// Visibilité production en lecture seule (Phase 5) — le rapport client
// formaté (photos, conclusion, sévérité) arrive en Phase 6 ; ici, la
// production voit simplement où en est le constat terrain.
async function DiagnosticSection({ appointmentId }: { appointmentId: string }) {
  const diagnostic = await getLatestDiagnosticForAppointment(appointmentId);
  if (!diagnostic) return null;

  const checkedCategories = diagnostic.checks.filter((c) => c.result !== "NOT_CHECKED");

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Diagnostic</h2>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
          {diagnosticStatusLabel(diagnostic.status)}
        </span>
      </div>

      {(diagnostic.mileageAtVisit || diagnostic.symptoms) && (
        <div className="mt-3 text-sm">
          {diagnostic.mileageAtVisit && (
            <p>
              <span className="text-white/50">Kilométrage : </span>
              {diagnostic.mileageAtVisit.toLocaleString("fr-FR")} km
            </p>
          )}
          {diagnostic.symptoms && (
            <p className="mt-1">
              <span className="text-white/50">Symptômes : </span>
              {diagnostic.symptoms}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-white/70">
        {checkedCategories.length}/10 points de contrôle vérifiés
        {diagnostic.faultCodes.length > 0 && ` · ${diagnostic.faultCodes.length} code(s) défaut`}
      </p>

      {checkedCategories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {checkedCategories.map((c) => (
            <span key={c.category} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
              {checkCategoryLabel(c.category)} : {checkResultLabel(c.result)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

async function TechnicianSection({ appointmentId, requestId }: { appointmentId: string; requestId: string }) {
  const [technicians, assignment] = await Promise.all([
    listTechnicians(),
    getActiveAssignmentForAppointment(appointmentId),
  ]);

  return (
    <div className="mt-6">
      <AssignTechnicianForm
        requestId={requestId}
        technicians={technicians.map((t) => ({ id: t.id, user: t.user }))}
        currentTechnicianName={
          assignment ? `${assignment.technician.user.firstName} ${assignment.technician.user.lastName}` : null
        }
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-white/50">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
