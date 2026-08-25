"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Technician = {
  id: string;
  user: { firstName: string; lastName: string };
};

export function AssignTechnicianForm({
  requestId,
  technicians,
  currentTechnicianName,
}: {
  requestId: string;
  technicians: Technician[];
  currentTechnicianName: string | null;
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAssign() {
    if (!technicianId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/production/service-requests/${requestId}/assign-technician`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible d'affecter ce technicien.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Technicien affecté</h2>
      <p className="mt-2 text-sm">{currentTechnicianName ?? "Aucun technicien affecté pour le moment."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
        >
          <option value="" className="text-black">
            Choisir un technicien
          </option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id} className="text-black">
              {t.user.firstName} {t.user.lastName}
            </option>
          ))}
        </select>
        <button
          onClick={onAssign}
          disabled={loading || !technicianId}
          className="rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
        >
          {loading ? "..." : currentTechnicianName ? "Réaffecter" : "Affecter"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
