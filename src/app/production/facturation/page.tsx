import Link from "next/link";
import { listInvoicesForProduction } from "@/lib/billing/service";
import { invoiceStatusLabel, formatXOF } from "@/lib/billing/options";
import type { InvoiceStatus } from "@prisma/client";

const FILTERS: { value: InvoiceStatus | undefined; label: string }[] = [
  { value: undefined, label: "Tout" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "ISSUED", label: "Émises" },
  { value: "PARTIALLY_PAID", label: "Partiellement payées" },
  { value: "OVERDUE", label: "En retard" },
  { value: "PAID", label: "Payées" },
];

export default async function ProductionBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const validStatus = (["DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID", "CANCELLED"] as const).includes(
    status as never
  )
    ? (status as InvoiceStatus)
    : undefined;

  const invoices = await listInvoicesForProduction({ status: validStatus });

  const totalDu = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
  const totalEncaisse = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Facturation</h1>
      <p className="mt-1 text-sm text-white/60">
        {invoices.length} facture(s) — {formatXOF(totalEncaisse)} encaissés, {formatXOF(totalDu)} restant dû
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/production/facturation?status=${f.value}` : "/production/facturation"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              validStatus === f.value ? "bg-chicano-red text-white" : "border border-white/20 text-white/70 hover:border-white/40"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/production/facturation/${inv.id}`}
            className="block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{inv.invoiceNumber}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  inv.status === "OVERDUE"
                    ? "bg-red-500/20 text-red-300"
                    : inv.status === "PAID"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-white/10"
                }`}
              >
                {invoiceStatusLabel(inv.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/70">
              {inv.customer?.user.firstName} {inv.customer?.user.lastName} — {inv.vehicle.make} {inv.vehicle.model}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {formatXOF(inv.total)} · payé {formatXOF(inv.amountPaid)} · solde {formatXOF(inv.balanceDue)}
            </p>
          </Link>
        ))}
        {invoices.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Aucune facture pour ce filtre.
          </p>
        )}
      </div>
    </div>
  );
}
