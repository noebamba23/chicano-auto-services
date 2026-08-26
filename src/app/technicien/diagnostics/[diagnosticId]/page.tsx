import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTechnicianIdForUser } from "@/lib/technicians/service";
import { getDiagnosticForTechnician, DiagnosticNotFoundError } from "@/lib/diagnostics/service";
import { diagnosticStatusLabel } from "@/lib/diagnostics/options";
import { DiagnosticChecklist } from "@/components/technicien/diagnostic-checklist";
import { FaultCodesForm } from "@/components/technicien/fault-codes-form";
import { CompleteDiagnosticButton } from "@/components/technicien/complete-diagnostic-button";

export default async function TechnicienDiagnosticPage({
  params,
}: {
  params: Promise<{ diagnosticId: string }>;
}) {
  const { diagnosticId } = await params;
  const session = await getSession();
  const technicianId = session ? await getTechnicianIdForUser(session.sub) : null;
  if (!technicianId) notFound();

  let diagnostic;
  try {
    diagnostic = await getDiagnosticForTechnician(technicianId, diagnosticId);
  } catch (err) {
    if (err instanceof DiagnosticNotFoundError) notFound();
    throw err;
  }

  const readOnly = diagnostic.status !== "IN_PROGRESS";

  return (
    <div>
      <Link href="/technicien" className="text-sm text-white/60 hover:text-white">
        ← Mes interventions
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Diagnostic — {diagnostic.appointment.serviceRequest.referenceNumber}</h1>
          <p className="mt-1 text-sm text-white/60">
            {diagnostic.vehicle.make} {diagnostic.vehicle.model} ({diagnostic.vehicle.chicanoVehicleId})
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
          {diagnosticStatusLabel(diagnostic.status)}
        </span>
      </div>

      {(diagnostic.mileageAtVisit || diagnostic.symptoms) && (
        <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          {diagnostic.mileageAtVisit && (
            <p className="text-sm">
              <span className="text-white/50">Kilométrage relevé : </span>
              {diagnostic.mileageAtVisit.toLocaleString("fr-FR")} km
            </p>
          )}
          {diagnostic.symptoms && (
            <p className="mt-1 text-sm">
              <span className="text-white/50">Symptômes : </span>
              {diagnostic.symptoms}
            </p>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Checklist</h2>
        <div className="mt-3">
          <DiagnosticChecklist diagnosticId={diagnostic.id} checks={diagnostic.checks} readOnly={readOnly} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Codes défaut</h2>
        <div className="mt-3">
          <FaultCodesForm diagnosticId={diagnostic.id} faultCodes={diagnostic.faultCodes} readOnly={readOnly} />
        </div>
      </section>

      {!readOnly && (
        <div className="mt-6">
          <CompleteDiagnosticButton diagnosticId={diagnostic.id} />
        </div>
      )}
    </div>
  );
}
