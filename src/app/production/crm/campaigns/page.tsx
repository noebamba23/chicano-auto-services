import { listCampaigns } from "@/lib/crm/campaigns";
import { CampaignForm, CampaignActions } from "@/components/production/campaign-actions";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div>
      <h1 className="text-2xl font-bold">Campagnes</h1>
      <p className="mt-1 text-sm text-white/60">
        Ciblage recalculé en direct au moment de l&apos;envoi — jamais une liste figée. Aucun envoi automatique, mode aperçu obligatoire avant tout envoi.
      </p>

      <div className="mt-6 space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{c.name}</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{c.status}</span>
            </div>
            <p className="mt-1 text-sm text-white/60">{c.objective} · segment {c.segment} · canal {c.channel}</p>
            <p className="mt-1 text-sm text-white/50">{c.message}</p>
            {c.status === "COMPLETED" && (
              <p className="mt-1 text-xs text-white/40">Envoyé : {c.sentCount} · ignoré : {c.skippedCount}</p>
            )}
            <div className="mt-3">
              <CampaignActions id={c.id} status={c.status} />
            </div>
          </div>
        ))}
        {campaigns.length === 0 && <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">Aucune campagne pour le moment.</p>}
      </div>

      <div className="mt-6">
        <CampaignForm />
      </div>
    </div>
  );
}
