import Link from "next/link";
import { getCustomer360 } from "@/lib/crm/customer360";
import { listCarePlans } from "@/lib/crm/care";
import { formatXOF, invoiceStatusLabel } from "@/lib/billing/options";
import { quoteStatusLabel } from "@/lib/quotes/options";
import { workOrderStatusLabel } from "@/lib/work-orders/options";
import { serviceRequestStatusLabel } from "@/lib/service-requests/options";
import {
  InteractionForm,
  FollowUpForm,
  FollowUpStatusButtons,
  CareSubscriptionForm,
  CareSubscriptionActions,
} from "@/components/production/crm-actions";

const AT_RISK_LABELS: Record<string, string> = {
  REFUSED_QUOTE: "Devis refusé récemment",
  OVERDUE_MAINTENANCE: "Entretien en retard",
  UNPAID_INVOICE: "Facture impayée",
  INTERRUPTED_WORK_ORDER: "Intervention interrompue",
  LONG_INACTIVITY: "Longue inactivité",
};

export default async function CrmClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [view, carePlans] = await Promise.all([getCustomer360(id), listCarePlans()]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{view.customer.firstName} {view.customer.lastName}</h1>
          <p className="mt-1 text-sm text-white/60">{view.customer.phoneE164} · {view.customer.customerType}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{view.segmentation.segment}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{view.segmentation.journeyStage}</span>
        </div>
      </div>

      {view.segmentation.signals.atRiskReasons.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-300">⚠ Signaux à risque</p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-200">
            {view.segmentation.signals.atRiskReasons.map((r) => (
              <li key={r}>{AT_RISK_LABELS[r] ?? r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">Interventions terminées</p>
          <p className="mt-1 text-xl font-bold">{view.summary.completedWorkOrders}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">Total facturé</p>
          <p className="mt-1 text-xl font-bold">{formatXOF(view.summary.totalBilled)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">Factures impayées</p>
          <p className="mt-1 text-xl font-bold">{view.summary.unpaidInvoices}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/50">Véhicules</p>
          <p className="mt-1 text-xl font-bold">{view.vehicles.length}</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Véhicules</h2>
      <div className="mt-3 space-y-2">
        {view.vehicles.map((v) => (
          <Link
            key={v.id}
            href={`/production/vehicules/${v.id}`}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <p className="font-semibold">{v.make} {v.model} {v.isPrimary && <span className="ml-1 text-xs text-white/40">(principal)</span>}</p>
            <p className="text-xs text-white/50">{v.chicanoVehicleId}{v.licensePlate ? ` · ${v.licensePlate}` : ""}</p>
          </Link>
        ))}
        {view.vehicles.length === 0 && <p className="text-sm text-white/50">Aucun véhicule enregistré.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Demandes de service ({view.history.serviceRequests.length})</h2>
      <div className="mt-3 space-y-2">
        {view.history.serviceRequests.slice(0, 10).map((r) => (
          <Link key={r.id} href={`/production/demandes/${r.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30">
            <div>
              <p className="font-semibold">{r.referenceNumber}</p>
              <p className="text-xs text-white/50">{r.category} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{serviceRequestStatusLabel(r.status)}</span>
          </Link>
        ))}
        {view.history.serviceRequests.length === 0 && <p className="text-sm text-white/50">Aucune demande.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Rendez-vous ({view.history.appointments.length})</h2>
      <div className="mt-3 space-y-2">
        {view.history.appointments.slice(0, 10).map((a) => (
          <Link
            key={a.id}
            href={`/production/demandes/${a.serviceRequestId}`}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <div>
              <p className="font-semibold">{a.serviceRequest?.referenceNumber ?? "—"}</p>
              <p className="text-xs text-white/50">
                {a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString("fr-FR") : "Non planifié"}
                {a.scheduledSlot ? ` — ${a.scheduledSlot}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{a.status}</span>
          </Link>
        ))}
        {view.history.appointments.length === 0 && <p className="text-sm text-white/50">Aucun rendez-vous.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Devis ({view.history.quotes.length})</h2>
      <div className="mt-3 space-y-2">
        {view.history.quotes.slice(0, 10).map((q) => (
          <div key={q.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-semibold">{q.quoteNumber}</p>
              <p className="text-xs text-white/50">{q.totalAmount ? formatXOF(Number(q.totalAmount)) : "Montant non figé"}</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{quoteStatusLabel(q.status)}</span>
          </div>
        ))}
        {view.history.quotes.length === 0 && <p className="text-sm text-white/50">Aucun devis.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Ordres de réparation ({view.history.workOrders.length})</h2>
      <div className="mt-3 space-y-2">
        {view.history.workOrders.slice(0, 10).map((w) => (
          <Link key={w.id} href={`/production/work-orders/${w.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30">
            <div>
              <p className="font-semibold">{w.workOrderNumber}</p>
              <p className="text-xs text-white/50">{new Date(w.createdAt).toLocaleDateString("fr-FR")}</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{workOrderStatusLabel(w.status)}</span>
          </Link>
        ))}
        {view.history.workOrders.length === 0 && <p className="text-sm text-white/50">Aucun ordre de réparation.</p>}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Facturation ({view.history.invoices.length})</h2>
      <div className="mt-3 space-y-2">
        {view.history.invoices.slice(0, 10).map((inv) => (
          <Link key={inv.id} href={`/production/facturation/${inv.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30">
            <div>
              <p className="font-semibold">{inv.invoiceNumber}</p>
              <p className="text-xs text-white/50">
                {formatXOF(Number(inv.total))} · solde {formatXOF(Number(inv.balanceDue))} · {inv.payments.length} paiement(s)
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{invoiceStatusLabel(inv.status)}</span>
          </Link>
        ))}
        {view.history.invoices.length === 0 && <p className="text-sm text-white/50">Aucune facture.</p>}
      </div>

      {view.history.reports.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-white/70">Rapports de diagnostic ({view.history.reports.length})</h2>
          <div className="mt-3 space-y-2">
            {view.history.reports.slice(0, 10).map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                <p className="font-semibold">{r.reportNumber} — {r.severity}</p>
                {r.conclusion && <p className="mt-1 text-white/60">{r.conclusion}</p>}
                <p className="mt-1 text-xs text-white/40">Publié le {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("fr-FR") : "—"}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-white/70">Consentement</h2>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {(["whatsappOptIn", "emailOptIn", "smsOptIn", "marketingOptIn"] as const).map((k) => (
          <span key={k} className={`rounded-full px-3 py-1 font-semibold ${view.consent[k] ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/50"}`}>
            {k} {view.consent[k] ? "✓" : "✕"}
          </span>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">CHICANO CARE</h2>
      <div className="mt-3 space-y-2">
        {view.careSubscriptions.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-semibold">{s.carePlan.name}</p>
              <p className="text-xs text-white/50">{s.status} · depuis le {new Date(s.startedAt).toLocaleDateString("fr-FR")}</p>
            </div>
            <CareSubscriptionActions id={s.id} status={s.status} />
          </div>
        ))}
        <CareSubscriptionForm
          customerId={id}
          carePlans={carePlans.map((p) => ({ id: p.id, name: p.name, price: p.price }))}
          vehicles={view.vehicles.map((v) => ({ id: v.id, make: v.make, model: v.model }))}
        />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Rappels de maintenance actifs</h2>
      <div className="mt-3 space-y-2">
        {view.reminders.length === 0 && <p className="text-sm text-white/50">Aucun rappel actif.</p>}
        {view.reminders.map((r) => (
          <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            {r.type} {r.dueAt ? `— ${new Date(r.dueAt).toLocaleDateString("fr-FR")}` : ""}
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Relances ({view.followUps.total})</h2>
      <div className="mt-3 space-y-2">
        {view.followUps.items.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-semibold">{f.reason}</p>
              <p className="text-xs text-white/50">{f.status} · échéance {new Date(f.dueAt).toLocaleDateString("fr-FR")}</p>
            </div>
            <FollowUpStatusButtons id={f.id} status={f.status} />
          </div>
        ))}
        <FollowUpForm customerId={id} />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Interactions ({view.interactions.total})</h2>
      <div className="mt-3 space-y-2">
        {view.interactions.items.map((i) => (
          <div key={i.id} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <p className="font-semibold">{i.type} {i.subject ? `— ${i.subject}` : ""}</p>
            {i.content && <p className="mt-1 text-white/60">{i.content}</p>}
            <p className="mt-1 text-xs text-white/40">{new Date(i.createdAt).toLocaleString("fr-FR")}</p>
          </div>
        ))}
        <InteractionForm customerId={id} />
      </div>
    </div>
  );
}
