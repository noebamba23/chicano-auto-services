import { listCarePlans } from "@/lib/crm/care";
import { formatXOF } from "@/lib/billing/options";
import { CarePlanForm, CarePlanToggle } from "@/components/production/care-plan-form";

export default async function CarePlansPage() {
  const plans = await listCarePlans(true);

  return (
    <div>
      <h1 className="text-2xl font-bold">CHICANO CARE — Catalogue</h1>
      <p className="mt-1 text-sm text-white/60">
        Prix/durée/fréquence libres, définis ici — aucun paiement récurrent automatique (les paiements restent le flux manuel existant).
      </p>

      <div className="mt-6 space-y-2">
        {plans.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-semibold">
                {p.name} {!p.active && <span className="ml-2 text-xs text-white/40">(inactif)</span>}
              </p>
              <p className="text-sm text-white/60">
                {formatXOF(p.price)} · {p.durationMonths} mois · entretien tous les {p.frequencyMonths} mois
              </p>
              {p.includedServices.length > 0 && (
                <p className="mt-1 text-xs text-white/40">{p.includedServices.join(", ")}</p>
              )}
            </div>
            <CarePlanToggle id={p.id} active={p.active} />
          </div>
        ))}
        {plans.length === 0 && <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">Aucun plan pour le moment.</p>}
      </div>

      <div className="mt-6">
        <CarePlanForm />
      </div>
    </div>
  );
}
