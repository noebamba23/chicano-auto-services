import Link from "next/link";
import { listServiceRequestsForProduction, type ProductionFilters } from "@/lib/service-requests/service";
import { serviceCategoryLabel, serviceRequestStatusLabel } from "@/lib/service-requests/options";
import type { ServiceRequestStatus } from "@prisma/client";

const FILTER_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "urgent", label: "Urgentes" },
  { key: "mobile", label: "Mobile" },
  { key: "garage", label: "Garage" },
  { key: "pending", label: "En attente" },
  { key: "accepted", label: "Acceptées" },
  { key: "rejected", label: "Refusées" },
];

function buildFilters(tab: string): ProductionFilters {
  switch (tab) {
    case "urgent":
      return { isUrgent: true };
    case "mobile":
      return { interventionType: "MOBILE" };
    case "garage":
      return { interventionType: "AT_GARAGE" };
    case "pending":
      return { status: "SUBMITTED" as ServiceRequestStatus };
    case "accepted":
      return { status: "ACCEPTED" as ServiceRequestStatus };
    case "rejected":
      return { status: "REJECTED" as ServiceRequestStatus };
    default:
      return {};
  }
}

export default async function ProductionDemandesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "all" } = await searchParams;
  const requests = await listServiceRequestsForProduction(buildFilters(tab));

  return (
    <div>
      <h1 className="text-2xl font-bold">Demandes de service</h1>
      <p className="mt-1 text-sm text-white/60">{requests.length} demande(s)</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/production/demandes?tab=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-chicano-red text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Véhicule</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Urgence</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/production/demandes/${r.id}`} className="font-semibold text-chicano-red">
                    {r.referenceNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.customer.user.firstName} {r.customer.user.lastName}
                </td>
                <td className="px-4 py-3">
                  {r.vehicle.make} {r.vehicle.model}
                </td>
                <td className="px-4 py-3">{serviceCategoryLabel(r.category)}</td>
                <td className="px-4 py-3">{r.isUrgent ? "🔴 Urgent" : "—"}</td>
                <td className="px-4 py-3">{r.interventionType === "MOBILE" ? "📍 Mobile" : "🏭 Garage"}</td>
                <td className="px-4 py-3">{serviceRequestStatusLabel(r.status)}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                  Aucune demande pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
