import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { getInvoiceForCustomer, InvoiceNotFoundError } from "@/lib/billing/service";
import { invoiceStatusLabel, invoiceItemTypeLabel, paymentMethodLabel, paymentStatusLabel, formatXOF } from "@/lib/billing/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import { PayButton } from "@/components/factures/pay-button";

export default async function ClientInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/factures/${id}`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let invoice;
  try {
    invoice = await getInvoiceForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) notFound();
    throw err;
  }

  const payable = invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID" || invoice.status === "OVERDUE";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/espace-client/factures" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes factures
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {invoice.vehicle.make} {invoice.vehicle.model} ({invoice.vehicle.chicanoVehicleId})
          </p>
          {invoice.vehicle.licensePlate && (
            <p className="mt-1 text-sm font-medium text-chicano-black">{formatPlateNumber(invoice.vehicle.licensePlate)}</p>
          )}
        </div>
        <span className="rounded-full bg-chicano-black px-3 py-1.5 text-sm font-semibold text-white">
          {invoiceStatusLabel(invoice.status)}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Détail</h2>
        <ul className="mt-3 divide-y divide-chicano-gray-light">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2 text-sm text-chicano-black">
              <span>
                {item.description} <span className="text-chicano-gray">({invoiceItemTypeLabel(item.type)})</span>
              </span>
              <span>{formatXOF(item.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-chicano-gray">Sous-total</span><span>{formatXOF(invoice.subtotal)}</span></div>
          {Number(invoice.travelFee) > 0 && <div className="flex justify-between"><span className="text-chicano-gray">Déplacement</span><span>{formatXOF(invoice.travelFee)}</span></div>}
          {Number(invoice.discount) > 0 && <div className="flex justify-between"><span className="text-chicano-gray">Remise</span><span>-{formatXOF(invoice.discount)}</span></div>}
          {Number(invoice.tax) > 0 && <div className="flex justify-between"><span className="text-chicano-gray">Taxe</span><span>{formatXOF(invoice.tax)}</span></div>}
        </div>
        <p className="mt-3 text-right text-lg font-bold text-chicano-black">Total : {formatXOF(invoice.total)}</p>
        <p className="text-right text-sm text-chicano-gray">Payé : {formatXOF(invoice.amountPaid)}</p>
        <p className="text-right text-sm font-semibold text-chicano-black">Solde : {formatXOF(invoice.balanceDue)}</p>
      </section>

      {invoice.payments.length > 0 && (
        <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Paiements &amp; reçus</h2>
          <ul className="mt-3 divide-y divide-chicano-gray-light">
            {invoice.payments
              .filter((p) => p.status === "CONFIRMED")
              .map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm text-chicano-black">
                  <span>
                    {p.receiptNumber} — {paymentMethodLabel(p.method)}
                  </span>
                  <span>{formatXOF(p.amount)} · {paymentStatusLabel(p.status)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {payable && (
        <div className="mt-6">
          <PayButton invoiceId={invoice.id} balanceDue={Number(invoice.balanceDue)} />
        </div>
      )}
    </div>
  );
}
