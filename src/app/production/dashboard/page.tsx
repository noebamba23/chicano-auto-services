import { getBusinessDashboardKpis } from "@/lib/billing/dashboard";
import { formatXOF } from "@/lib/billing/options";

export default async function ProductionDashboardPage() {
  const kpis = await getBusinessDashboardKpis();

  const cards = [
    { label: "CA du jour", value: formatXOF(kpis.caJour) },
    { label: "CA du mois", value: formatXOF(kpis.caMois) },
    { label: "Encaissements (mois)", value: formatXOF(kpis.encaissementsMois) },
    { label: "Factures émises", value: String(kpis.facturesEmises) },
    { label: "Factures impayées", value: String(kpis.facturesImpayees) },
    { label: "Interventions (mois)", value: String(kpis.interventionsMois) },
    { label: "Panier moyen", value: formatXOF(kpis.panierMoyen) },
    { label: "Taux d'acceptation devis", value: `${kpis.tauxAcceptationDevis.toFixed(0)} %` },
    { label: "Marge brute (mois)", value: formatXOF(kpis.margeBruteMois) },
    { label: "Clients actifs (mois)", value: String(kpis.clientsActifs) },
    { label: "Véhicules actifs (mois)", value: String(kpis.vehiculesActifs) },
    { label: "Clients récurrents", value: String(kpis.clientsRecurrents) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-white/60">Indicateurs calculés depuis les données réelles — interne, jamais visible côté client.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
