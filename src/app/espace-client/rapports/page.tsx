import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { listPublishedReportsForCustomer } from "@/lib/reports/service";
import { severityLabel } from "@/lib/reports/options";

export default async function MesRapportsPage() {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/espace-client/rapports");

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  const reports = await listPublishedReportsForCustomer(customerId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Mes rapports</h1>
      <p className="mt-1 text-sm text-chicano-gray">
        {reports.length === 0 ? "Aucun rapport pour le moment." : `${reports.length} rapport(s)`}
      </p>

      {reports.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-chicano-gray-light bg-white p-8 text-center">
          <p className="text-sm text-chicano-gray">
            Vos rapports de diagnostic apparaîtront ici une fois publiés par notre équipe.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/espace-client/rapports/${r.id}`}
              className="rounded-lg border border-chicano-gray-light bg-white p-4 hover:border-chicano-red"
            >
              <p className="font-semibold text-chicano-black">{r.reportNumber}</p>
              <p className="mt-1 text-sm text-chicano-gray">
                {r.diagnostic.vehicle.make} {r.diagnostic.vehicle.model}
              </p>
              <p className="mt-2 text-xs text-chicano-gray">{severityLabel(r.severity)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
