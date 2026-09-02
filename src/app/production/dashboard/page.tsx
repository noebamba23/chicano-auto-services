import { getBusinessDashboardKpis } from "@/lib/billing/dashboard";
import { getCrmCeoKpis } from "@/lib/crm/dashboard";
import { formatXOF } from "@/lib/billing/options";

export default async function ProductionDashboardPage() {
  const [kpis, crm] = await Promise.all([getBusinessDashboardKpis(), getCrmCeoKpis()]);

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

  const crmCards = [
    { label: "Clients réactivés (mois)", value: String(crm.reactivatedCustomersThisMonth) },
    { label: "CA moyen / client", value: formatXOF(crm.caMoyenParClient) },
    { label: "Interventions / client", value: crm.interventionsParClient.toFixed(1) },
    { label: "Taux rappel → rendez-vous", value: `${crm.tauxRappelRendezVous.toFixed(0)} %` },
    { label: "Taux CHICANO CARE", value: `${crm.tauxChicanoCare.toFixed(1)} %` },
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

      <h2 className="mt-8 text-sm font-semibold text-white/70">Croissance commerciale (CRM — voir aussi /production/crm)</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {crmCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
