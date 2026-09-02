"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: Record<string, unknown>, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Une erreur est survenue.");
  }
  return res.json();
}

const btn = "rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60";
const input = "w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40";

const INTERACTION_TYPES = ["CALL", "WHATSAPP", "EMAIL", "SMS", "NOTE", "APPOINTMENT", "FOLLOW_UP"] as const;

export function InteractionForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof INTERACTION_TYPES)[number]>("NOTE");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await post(`/api/production/crm/customers/${customerId}/interactions`, { type, subject, content });
      setSubject("");
      setContent("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Nouvelle interaction</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white">
          {INTERACTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" className={`${input} max-w-xs`} />
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Détail..." rows={2} className={`${input} mt-2`} />
      <button onClick={submit} disabled={loading} className={`${btn} mt-3`}>
        {loading ? "..." : "Enregistrer"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function FollowUpForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || !dueAt) return;
    setLoading(true);
    setError(null);
    try {
      await post("/api/production/crm/follow-ups", { customerId, reason, dueAt: new Date(dueAt).toISOString() });
      setReason("");
      setDueAt("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Nouvelle relance</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif" className={`${input} max-w-xs`} />
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={input} />
      </div>
      <button onClick={submit} disabled={loading} className={`${btn} mt-3`}>
        {loading ? "..." : "Créer la relance"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function FollowUpStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(action: "COMPLETE" | "CANCEL") {
    setLoading(true);
    try {
      await post(`/api/production/crm/follow-ups/${id}`, { action }, "PATCH");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status !== "PENDING") return null;
  return (
    <div className="flex gap-2">
      <button onClick={() => run("COMPLETE")} disabled={loading} className="rounded-md bg-green-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
        ✓ Faite
      </button>
      <button onClick={() => run("CANCEL")} disabled={loading} className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80">
        Annuler
      </button>
    </div>
  );
}

export function CareSubscriptionForm({ customerId, carePlans, vehicles }: {
  customerId: string;
  carePlans: { id: string; name: string; price: number }[];
  vehicles: { id: string; make: string; model: string }[];
}) {
  const router = useRouter();
  const [carePlanId, setCarePlanId] = useState(carePlans[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!carePlanId) return;
    setLoading(true);
    setError(null);
    try {
      await post(`/api/production/crm/customers/${customerId}/care-subscriptions`, {
        carePlanId,
        ...(vehicleId ? { vehicleId } : {}),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (carePlans.length === 0) return <p className="text-sm text-white/50">Aucun plan CHICANO CARE actif à proposer.</p>;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold">Proposer CHICANO CARE</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={carePlanId} onChange={(e) => setCarePlanId(e.target.value)} className="rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white">
          {carePlans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white">
          <option value="">Compte client (tous véhicules)</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.make} {v.model}</option>
          ))}
        </select>
      </div>
      <button onClick={submit} disabled={loading} className={`${btn} mt-3`}>
        {loading ? "..." : "Activer l'abonnement"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function CareSubscriptionActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(action: "PAUSE" | "RESUME" | "CANCEL") {
    setLoading(true);
    try {
      await post(`/api/production/crm/care-subscriptions/${id}`, { action }, "PATCH");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status !== "ACTIVE" && status !== "PAUSED") return null;
  return (
    <div className="flex gap-2">
      {status === "ACTIVE" && (
        <button onClick={() => run("PAUSE")} disabled={loading} className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80">
          Suspendre
        </button>
      )}
      {status === "PAUSED" && (
        <button onClick={() => run("RESUME")} disabled={loading} className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80">
          Réactiver
        </button>
      )}
      <button onClick={() => run("CANCEL")} disabled={loading} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300">
        Résilier
      </button>
    </div>
  );
}
