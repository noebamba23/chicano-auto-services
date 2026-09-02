"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const btn = "rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60";
const input = "w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40";

export function CarePlanForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationMonths, setDurationMonths] = useState("12");
  const [frequencyMonths, setFrequencyMonths] = useState("3");
  const [includedServices, setIncludedServices] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name || !price) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/production/crm/care-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          price: Number(price),
          durationMonths: Number(durationMonths),
          frequencyMonths: Number(frequencyMonths),
          includedServices: includedServices.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur");
      }
      setName("");
      setDescription("");
      setPrice("");
      setIncludedServices("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Nouveau plan CHICANO CARE</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du plan" className={input} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Prix (XOF)" className={input} />
        <input value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} type="number" placeholder="Durée (mois)" className={input} />
        <input value={frequencyMonths} onChange={(e) => setFrequencyMonths(e.target.value)} type="number" placeholder="Fréquence (mois)" className={input} />
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className={`${input} mt-2`} />
      <input value={includedServices} onChange={(e) => setIncludedServices(e.target.value)} placeholder="Services inclus (séparés par des virgules)" className={`${input} mt-2`} />
      <button onClick={submit} disabled={loading} className={`${btn} mt-3`}>
        {loading ? "..." : "Créer le plan"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function CarePlanToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/production/crm/care-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={toggle} disabled={loading} className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80">
      {active ? "Désactiver" : "Réactiver"}
    </button>
  );
}
