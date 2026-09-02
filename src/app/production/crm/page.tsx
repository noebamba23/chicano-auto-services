import Link from "next/link";
import { getCrmDashboardKpis, getCrmCeoKpis } from "@/lib/crm/dashboard";
import { formatXOF } from "@/lib/billing/options";

export default async function ProductionCrmPage() {
  const [kpis, ceo] = await Promise.all([getCrmDashboardKpis(), getCrmCeoKpis()]);

  const segmentCards = [
    { label: "Nouveaux", value: kpis.newCustomers, href: "/production/crm/clients?segment=NEW" },
    { label: "Actifs", value: kpis.activeCustomers, href: "/production/crm/clients?segment=ACTIVE" },
    { label: "Récurrents", value: kpis.recurringCustomers, href: "/production/crm/clients?segment=RECURRING" },
    { label: "VIP", value: kpis.vipCustomers, href: "/production/crm/clients?segment=VIP" },
    { label: "Dormants", value: kpis.dormantCustomers, href: "/production/crm/clients?segment=DORMANT" },
    { label: "À risque", value: kpis.atRiskCustomers, href: "/production/crm/clients?segment=AT_RISK" },
  ];

  const otherCards = [
    { label: "Relances en attente", value: kpis.pendingFollowUps },
    { label: "Relances en retard", value: kpis.overdueFollowUps },
    { label: "Rappels dus", value: kpis.dueReminders },
    { label: "Rappels en retard", value: kpis.overdueReminders },
    { label: "Campagnes brouillon", value: kpis.campaignsDraft },
    { label: "Campagnes en cours/planifiées", value: kpis.campaignsRunningOrScheduled },
    { label: "Abonnements CHICANO CARE actifs", value: kpis.activeCareSubscriptions },
    { label: "Taux CHICANO CARE", value: `${kpis.careAdoptionRate.toFixed(1)} %` },
  ];

  const ceoCards = [
    { label: "Clients réactivés (mois)", value: String(ceo.reactivatedCustomersThisMonth) },
    { label: "CA moyen / client", value: formatXOF(ceo.caMoyenParClient) },
    { label: "Interventions / client", value: ceo.interventionsParClient.toFixed(1) },
    { label: "Taux rappel → rendez-vous", value: `${ceo.tauxRappelRendezVous.toFixed(0)} %` },
    { label: "Taux CHICANO CARE", value: `${ceo.tauxChicanoCare.toFixed(1)} %` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CRM</h1>
        <div className="flex gap-2">
          <Link href="/production/crm/clients" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40">
            Clients
          </Link>
          <Link href="/production/crm/follow-ups" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40">
            Relances
          </Link>
          <Link href="/production/crm/care-plans" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40">
            CHICANO CARE
          </Link>
          <Link href="/production/crm/campaigns" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40">
            Campagnes
          </Link>
        </div>
      </div>

      <p className="mt-1 text-sm text-white/60">Segmentation comportementale — calculée en direct depuis les données réelles, jamais un score IA.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {segmentCards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30">
            <p className="text-xs text-white/50">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Opérationnel</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {otherCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-white/70">Indicateurs CEO — croissance commerciale</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ceoCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
