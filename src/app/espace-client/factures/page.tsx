import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { listInvoicesForCustomer } from "@/lib/billing/service";
import { invoiceStatusLabel, formatXOF } from "@/lib/billing/options";

export default async function ClientInvoicesPage() {
  const session = await getSession();
  const customerId = session ? await getCustomerIdForUser(session.sub) : null;
  const invoices = customerId ? await listInvoicesForCustomer(customerId) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Mes factures</h1>
      <p className="mt-1 text-sm text-chicano-gray">{invoices.length} facture(s)</p>

      <div className="mt-6 space-y-3">
        {invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/espace-client/factures/${inv.id}`}
            className="block rounded-lg border border-chicano-gray-light bg-white p-4 hover:border-chicano-red"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-chicano-black">{inv.invoiceNumber}</p>
              <span className="rounded-full bg-chicano-gray-light px-2 py-0.5 text-xs text-chicano-black">
                {invoiceStatusLabel(inv.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-chicano-gray">
              {inv.vehicle.make} {inv.vehicle.model} — {new Date(inv.issuedAt ?? inv.createdAt).toLocaleDateString("fr-FR")}
            </p>
            <p className="mt-1 text-sm font-medium text-chicano-black">
              {formatXOF(inv.total)} · solde {formatXOF(inv.balanceDue)}
            </p>
          </Link>
        ))}
        {invoices.length === 0 && (
          <p className="rounded-lg border border-chicano-gray-light bg-white p-6 text-center text-sm text-chicano-gray">
            Aucune facture pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
