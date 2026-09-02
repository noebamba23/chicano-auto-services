"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const btn = "rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60";
const input = "w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40";

const OBJECTIVES = ["MAINTENANCE", "SEASONAL_CHECK", "BATTERY", "TYRES", "TRAVEL_CHECK", "REACTIVATION", "CARE"] as const;
const SEGMENTS = ["NEW", "ACTIVE", "RECURRING", "DORMANT", "AT_RISK", "VIP"] as const;

export function CampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<(typeof OBJECTIVES)[number]>("MAINTENANCE");
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>("DORMANT");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name || !message) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/production/crm/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, objective, segment, channel: "WHATSAPP", message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur");
      }
      setName("");
      setMessage("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Nouvelle campagne (canal WhatsApp)</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la campagne" className={input} />
        <select value={objective} onChange={(e) => setObjective(e.target.value as typeof objective)} className="rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white">
          {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={segment} onChange={(e) => setSegment(e.target.value as typeof segment)} className="rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white">
          {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message..." rows={3} className={`${input} mt-2`} />
      <button onClick={submit} disabled={loading} className={`${btn} mt-3`}>
        {loading ? "..." : "Créer (brouillon)"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function CampaignActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ eligible: number; totalInSegment: number; skippedNoConsent: number; channelAvailable: boolean; mockActive: boolean } | null>(null);

  async function doPreview() {
    setLoading(true);
    try {
      const res = await fetch(`/api/production/crm/campaigns/${id}/preview`, { method: "POST" });
      setPreview(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function doSend() {
    setLoading(true);
    try {
      await fetch(`/api/production/crm/campaigns/${id}/send`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function doCancel() {
    setLoading(true);
    try {
      await fetch(`/api/production/crm/campaigns/${id}/cancel`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status !== "DRAFT" && status !== "SCHEDULED") return null;

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={doPreview} disabled={loading} className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80">
          👁 Prévisualiser
        </button>
        {preview && (
          <button onClick={doSend} disabled={loading || preview.eligible === 0} className={`${btn} py-1.5 text-xs`}>
            Envoyer ({preview.eligible} destinataire{preview.eligible > 1 ? "s" : ""})
          </button>
        )}
        <button onClick={doCancel} disabled={loading} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300">
          Annuler
        </button>
      </div>
      {preview && (
        <p className="mt-2 text-xs text-white/50">
          {preview.totalInSegment} client(s) dans le segment · {preview.eligible} éligible(s) (consentement + canal)
          {!preview.channelAvailable && " · canal non configuré, aucun envoi possible"}
          {preview.channelAvailable && preview.mockActive && " · mode WhatsApp mock (pas d'envoi réel)"}
        </p>
      )}
    </div>
  );
}
