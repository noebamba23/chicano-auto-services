import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoiceForProduction, computeWorkOrderMargin, InvoiceNotFoundError } from "@/lib/billing/service";
import { invoiceStatusLabel, invoiceItemTypeLabel, paymentMethodLabel, paymentStatusLabel, formatXOF } from "@/lib/billing/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import { InvoiceActions } from "@/components/production/invoice-actions";

export default async function ProductionInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let invoice;
  try {
    invoice = await getInvoiceForProduction(id);
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) notFound();
    throw err;
  }

  const margin = invoice.workOrder ? await computeWorkOrderMargin(invoice.workOrder.id) : null;

  return (
    <div>
      <Link href="/production/facturation" className="text-sm text-white/60 hover:text-white">
        ← Facturation
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-white/60">
            {invoice.customer?.user.firstName} {invoice.customer?.user.lastName} — {invoice.customer?.user.phoneE164}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">{invoiceStatusLabel(invoice.status)}</span>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Véhicule" value={`${invoice.vehicle.make} ${invoice.vehicle.model} (${invoice.vehicle.chicanoVehicleId})`} />
          {invoice.vehicle.licensePlate && <Field label="Immatriculation" value={formatPlateNumber(invoice.vehicle.licensePlate) ?? ""} />}
          {invoice.workOrder && <Field label="Work Order" value={invoice.workOrder.workOrderNumber} />}
          <Field label="Échéance" value={invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("fr-FR") : "—"} />
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Lignes</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/10">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3">{item.description}</td>
                  <td className="p-3 text-white/50">{invoiceItemTypeLabel(item.type)}</td>
                  <td className="p-3 text-right">{Number(item.quantity)} × {formatXOF(item.unitPrice)}</td>
                  <td className="p-3 text-right font-medium">{formatXOF(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-white/50">Sous-total</span><span>{formatXOF(invoice.subtotal)}</span></div>
          {Number(invoice.travelFee) > 0 && <div className="flex justify-between"><span className="text-white/50">Déplacement</span><span>{formatXOF(invoice.travelFee)}</span></div>}
          {Number(invoice.discount) > 0 && <div className="flex justify-between"><span className="text-white/50">Remise</span><span>-{formatXOF(invoice.discount)}</span></div>}
          {Number(invoice.tax) > 0 && <div className="flex justify-between"><span className="text-white/50">Taxe</span><span>{formatXOF(invoice.tax)}</span></div>}
          <div className="flex justify-between border-t border-white/10 pt-1 font-bold"><span>Total</span><span>{formatXOF(invoice.total)}</span></div>
          <div className="flex justify-between text-green-400"><span>Payé</span><span>{formatXOF(invoice.amountPaid)}</span></div>
          <div className="flex justify-between font-semibold"><span>Solde dû</span><span>{formatXOF(invoice.balanceDue)}</span></div>
        </div>
      </section>

      {invoice.payments.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Paiements</h2>
          <div className="mt-3 space-y-2">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                <span>{p.paymentNumber} — {paymentMethodLabel(p.method)}</span>
                <span className="flex items-center gap-2">
                  {formatXOF(p.amount)}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{paymentStatusLabel(p.status)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {margin && (
        <section className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Marge (interne — jamais visible côté client)
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-white/50">Revenu</dt><dd>{formatXOF(margin.revenue)}</dd></div>
            <div><dt className="text-xs text-white/50">Coût pièces</dt><dd>{formatXOF(margin.partsCost)}</dd></div>
            <div><dt className="text-xs text-white/50">Coût main-d&apos;œuvre</dt><dd>{formatXOF(margin.laborCost)}</dd></div>
            <div><dt className="text-xs text-white/50">Marge brute</dt><dd className="font-bold text-amber-300">{formatXOF(margin.grossMargin)}</dd></div>
          </dl>
        </section>
      )}

      <div className="mt-6">
        <InvoiceActions invoiceId={invoice.id} status={invoice.status} balanceDue={Number(invoice.balanceDue)} />
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
