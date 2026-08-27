import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { getQuoteForCustomer, QuoteNotFoundError } from "@/lib/quotes/service";
import { quoteStatusLabel, formatXOF } from "@/lib/quotes/options";
import { QuoteResponseActions } from "@/components/quotes/quote-response-actions";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/devis/${id}`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let quote;
  try {
    quote = await getQuoteForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof QuoteNotFoundError) notFound();
    throw err;
  }

  const latestVersion = quote.versions[quote.versions.length - 1];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/espace-client/devis" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes devis
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">{quote.quoteNumber}</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {quote.vehicle.make} {quote.vehicle.model} ({quote.vehicle.chicanoVehicleId})
          </p>
          {quote.vehicle.licensePlate && (
            <p className="mt-1 text-sm font-medium text-chicano-black">
              {formatPlateNumber(quote.vehicle.licensePlate)}
            </p>
          )}
        </div>
        <span className="rounded-full bg-chicano-black px-3 py-1.5 text-sm font-semibold text-white">
          {quoteStatusLabel(quote.status)}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Détail (v{quote.currentVersion})</h2>
        <ul className="mt-3 divide-y divide-chicano-gray-light">
          {latestVersion.items.map((it) => (
            <li key={it.id} className="flex justify-between py-2 text-sm text-chicano-black">
              <span>
                {it.label} × {Number(it.quantity)}
              </span>
              <span>{formatXOF(Number(it.unitPrice) * Number(it.quantity))}</span>
            </li>
          ))}
          {latestVersion.laborAmount && (
            <li className="flex justify-between py-2 text-sm text-chicano-black">
              <span>Main d&apos;œuvre</span>
              <span>{formatXOF(latestVersion.laborAmount)}</span>
            </li>
          )}
          {latestVersion.travelAmount && (
            <li className="flex justify-between py-2 text-sm text-chicano-black">
              <span>Déplacement</span>
              <span>{formatXOF(latestVersion.travelAmount)}</span>
            </li>
          )}
        </ul>
        <p className="mt-3 text-right text-lg font-bold text-chicano-black">Total : {formatXOF(quote.totalAmount)}</p>
        {latestVersion.leadTimeDays && (
          <p className="mt-2 text-sm text-chicano-gray">Délai estimé : {latestVersion.leadTimeDays} jour(s)</p>
        )}
        {latestVersion.terms && <p className="mt-2 text-sm text-chicano-gray">{latestVersion.terms}</p>}
      </section>

      {quote.status === "SENT" && (
        <div className="mt-6">
          <QuoteResponseActions quoteId={quote.id} />
        </div>
      )}
    </div>
  );
}
