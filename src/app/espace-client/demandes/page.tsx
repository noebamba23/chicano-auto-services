import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { listServiceRequestsForCustomer } from "@/lib/service-requests/service";
import { ServiceRequestCard } from "@/components/service-requests/service-request-card";

export default async function MesDemandesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/espace-client/demandes");

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  const requests = await listServiceRequestsForCustomer(customerId);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">Mes demandes</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {requests.length === 0 ? "Aucune demande pour le moment." : `${requests.length} demande(s)`}
          </p>
        </div>
        <Link
          href="/espace-client/demande-service"
          className="rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark"
        >
          + Demander un service
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-chicano-gray-light bg-white p-8 text-center">
          <p className="text-sm text-chicano-gray">
            Vous n&apos;avez pas encore fait de demande de service auprès de CHICANO.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r) => (
            <ServiceRequestCard key={r.id} request={r} href={`/espace-client/demandes/${r.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
