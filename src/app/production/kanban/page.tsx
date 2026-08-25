import Link from "next/link";
import { listServiceRequestsForProduction } from "@/lib/service-requests/service";
import { serviceCategoryLabel } from "@/lib/service-requests/options";
import type { ServiceRequestStatus } from "@prisma/client";

// Kanban Phase 4 : les colonnes reflètent uniquement les statuts réellement
// pilotables aujourd'hui (ServiceRequestStatus) — pas la chaîne complète
// diagnostic/devis/réparation du prompt maître (section 45), hors périmètre
// tant que ces modules ne sont pas construits (voir docs/SERVICE-REQUESTS.md).
// Interaction volontairement par clic (pas de glisser-déposer, pas de
// dépendance de librairie DnD) : chaque carte ouvre la fiche demande, où les
// transitions déjà auditées (accepter/refuser/replanifier/mettre en
// examen/terminer) restent la seule voie de changement de statut.
const COLUMNS: { status: ServiceRequestStatus; title: string }[] = [
  { status: "SUBMITTED", title: "Nouvelles demandes" },
  { status: "UNDER_REVIEW", title: "En examen" },
  { status: "RESCHEDULE_REQUESTED", title: "Nouveau créneau proposé" },
  { status: "ACCEPTED", title: "Planifiées" },
  { status: "COMPLETED", title: "Terminées" },
];

export default async function ProductionKanbanPage() {
  const allRequests = await listServiceRequestsForProduction({});
  const closed = allRequests.filter((r) => r.status === "REJECTED" || r.status === "CANCELLED");

  return (
    <div>
      <h1 className="text-2xl font-bold">Kanban production</h1>
      <p className="mt-1 text-sm text-white/60">{allRequests.length} demande(s) au total</p>

      <div className="mt-6 grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = allRequests.filter((r) => r.status === col.status);
          return (
            <div key={col.status} className="min-w-[220px] rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">{col.title}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{items.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/production/demandes/${r.id}`}
                    className="block rounded-md border border-white/10 bg-chicano-black p-3 hover:border-chicano-red"
                  >
                    <p className="text-sm font-semibold text-chicano-red">{r.referenceNumber}</p>
                    <p className="mt-1 text-xs text-white/70">
                      {r.customer.user.firstName} {r.customer.user.lastName}
                    </p>
                    <p className="text-xs text-white/50">
                      {r.vehicle.make} {r.vehicle.model} — {serviceCategoryLabel(r.category)}
                    </p>
                    {r.isUrgent && <p className="mt-1 text-xs text-chicano-red">🔴 Urgent</p>}
                  </Link>
                ))}
                {items.length === 0 && <p className="text-xs text-white/30">Vide</p>}
              </div>
            </div>
          );
        })}
      </div>

      {closed.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Refusées / annulées ({closed.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {closed.map((r) => (
              <Link
                key={r.id}
                href={`/production/demandes/${r.id}`}
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-chicano-red hover:text-white"
              >
                {r.referenceNumber}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
