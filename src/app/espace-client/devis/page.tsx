import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { listQuotesForCustomer } from "@/lib/quotes/service";
import { quoteStatusLabel, formatXOF } from "@/lib/quotes/options";

export default async function MesDevisPage() {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/espace-client/devis");

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  const quotes = await listQuotesForCustomer(customerId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Mes devis</h1>
      <p className="mt-1 text-sm text-chicano-gray">
        {quotes.length === 0 ? "Aucun devis pour le moment." : `${quotes.length} devis`}
      </p>

      {quotes.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-chicano-gray-light bg-white p-8 text-center">
          <p className="text-sm text-chicano-gray">Vos devis apparaîtront ici une fois envoyés par notre équipe.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
            <Link
              key={q.id}
              href={`/espace-client/devis/${q.id}`}
              className="rounded-lg border border-chicano-gray-light bg-white p-4 hover:border-chicano-red"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-chicano-black">{q.quoteNumber}</p>
                <span className="rounded-full bg-chicano-black px-2 py-0.5 text-xs text-white">
                  {quoteStatusLabel(q.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-chicano-gray">
                {q.vehicle.make} {q.vehicle.model}
              </p>
              <p className="mt-2 text-sm font-semibold text-chicano-black">{formatXOF(q.totalAmount)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
