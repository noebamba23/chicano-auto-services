import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTechnicianIdForUser, getAssignmentForTechnician, AssignmentNotFoundError } from "@/lib/technicians/service";
import { interventionTypeLabel, serviceCategoryLabel, slotLabel } from "@/lib/service-requests/options";
import { InterventionActions } from "@/components/technicien/intervention-actions";

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "À faire",
  EN_ROUTE: "En route",
  ARRIVED: "Arrivé",
  COMPLETED: "Terminée",
};

export default async function TechnicienInterventionPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const session = await getSession();
  const technicianId = session ? await getTechnicianIdForUser(session.sub) : null;
  if (!technicianId) notFound();

  let assignment;
  try {
    assignment = await getAssignmentForTechnician(technicianId, assignmentId);
  } catch (err) {
    if (err instanceof AssignmentNotFoundError) notFound();
    throw err;
  }

  const { appointment } = assignment;
  const diagnostic = appointment.diagnostics[0] ?? null;

  return (
    <div>
      <Link href="/technicien" className="text-sm text-white/60 hover:text-white">
        ← Mes interventions
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{appointment.serviceRequest.referenceNumber}</h1>
          <p className="mt-1 text-sm text-white/60">
            {appointment.customer.user.firstName} {appointment.customer.user.lastName} —{" "}
            {appointment.customer.user.phoneE164}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
          {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Véhicule" value={`${appointment.vehicle.make} ${appointment.vehicle.model} (${appointment.vehicle.chicanoVehicleId})`} />
          <Field label="Service" value={serviceCategoryLabel(appointment.serviceRequest.category)} />
          <Field label="Mode d'intervention" value={interventionTypeLabel(appointment.interventionType)} />
          <Field label="Urgence" value={appointment.serviceRequest.isUrgent ? "🔴 Urgent" : "Non"} />
          <Field
            label="Rendez-vous"
            value={`${appointment.scheduledDate ? new Date(appointment.scheduledDate).toLocaleDateString("fr-FR") : "À définir"} — ${slotLabel(appointment.scheduledSlot) ?? "À définir"}`}
          />
        </dl>

        {appointment.location && (
          <div className="mt-4">
            <p className="text-xs text-white/50">Localisation</p>
            <p className="mt-1 text-sm">
              {[appointment.location.neighborhood, appointment.location.commune, appointment.location.city, appointment.location.landmark]
                .filter(Boolean)
                .join(", ") || "Position GPS transmise"}
            </p>
            {appointment.location.latitude && appointment.location.longitude && (
              <p className="mt-1 text-xs text-white/50">
                {appointment.location.latitude.toFixed(5)}, {appointment.location.longitude.toFixed(5)}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="mt-6">
        <InterventionActions assignmentId={assignment.id} status={assignment.status} diagnosticId={diagnostic?.id ?? null} />
      </div>
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
