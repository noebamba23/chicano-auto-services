import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getTechnicianIdForUser, listAssignmentsForTechnician } from "@/lib/technicians/service";
import { slotLabel } from "@/lib/service-requests/options";

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "À faire",
  EN_ROUTE: "En route",
  ARRIVED: "Arrivé",
  COMPLETED: "Terminée",
};

export default async function TechnicienDashboardPage() {
  const session = await getSession();
  const technicianId = session ? await getTechnicianIdForUser(session.sub) : null;
  const assignments = technicianId ? await listAssignmentsForTechnician(technicianId) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Mes interventions</h1>
      <p className="mt-1 text-sm text-white/60">{assignments.length} intervention(s) en cours</p>

      <div className="mt-6 space-y-3">
        {assignments.map((a) => (
          <Link
            key={a.id}
            href={`/technicien/interventions/${a.id}`}
            className="block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{a.appointment.serviceRequest.referenceNumber}</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                {ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/70">
              {a.appointment.customer.user.firstName} {a.appointment.customer.user.lastName} —{" "}
              {a.appointment.vehicle.make} {a.appointment.vehicle.model}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {a.appointment.scheduledDate
                ? new Date(a.appointment.scheduledDate).toLocaleDateString("fr-FR")
                : "Date à définir"}{" "}
              — {slotLabel(a.appointment.scheduledSlot) ?? "Créneau à définir"}
              {a.appointment.serviceRequest.isUrgent ? " · 🔴 Urgent" : ""}
            </p>
          </Link>
        ))}
        {assignments.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Aucune intervention affectée pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
