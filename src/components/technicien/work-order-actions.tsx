"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkOrderStatus } from "@prisma/client";

export function TechnicienWorkOrderActions({ workOrderId, status }: { workOrderId: string; status: WorkOrderStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissingPart, setShowMissingPart] = useState(false);
  const [partLabel, setPartLabel] = useState("");
  const [showAdditionalWork, setShowAdditionalWork] = useState(false);
  const [additionalWorkNotes, setAdditionalWorkNotes] = useState("");

  async function run(url: string, body: Record<string, unknown> = {}) {
    setLoading(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
    setShowMissingPart(false);
    setShowAdditionalWork(false);
  }

  const btn = "w-full rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60";
  const btnGhost = "w-full rounded-md border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60";

  if (status === "COMPLETED" || status === "CANCELLED") return null;

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
      {status === "SCHEDULED" && (
        <button onClick={() => run(`/api/technicien/work-orders/${workOrderId}/start`)} disabled={loading} className={btn}>
          {loading ? "..." : "▶️ Démarrer les travaux"}
        </button>
      )}

      {status === "IN_PROGRESS" && (
        <>
          <button onClick={() => run(`/api/technicien/work-orders/${workOrderId}/pause`)} disabled={loading} className={btnGhost}>
            {loading ? "..." : "⏸️ Mettre en pause"}
          </button>
          <button onClick={() => run(`/api/technicien/work-orders/${workOrderId}/quality-check`)} disabled={loading} className={btn}>
            {loading ? "..." : "✅ Envoyer au contrôle qualité"}
          </button>
        </>
      )}

      {status === "IN_PROGRESS" && !showMissingPart && (
        <button onClick={() => setShowMissingPart(true)} className={btnGhost}>
          🔩 Signaler une pièce manquante
        </button>
      )}

      {showMissingPart && (
        <div>
          <input
            value={partLabel}
            onChange={(e) => setPartLabel(e.target.value)}
            placeholder="Pièce manquante (ex. Disque de frein avant)"
            className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setShowMissingPart(false)} className={btnGhost}>
              Annuler
            </button>
            <button
              onClick={() =>
                partLabel && run(`/api/technicien/work-orders/${workOrderId}/missing-part`, { label: partLabel })
              }
              disabled={loading || !partLabel}
              className={btn}
            >
              {loading ? "..." : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {!showAdditionalWork && (
        <button onClick={() => setShowAdditionalWork(true)} className={btnGhost}>
          ⚠️ Signaler des travaux supplémentaires
        </button>
      )}

      {showAdditionalWork && (
        <div>
          <textarea
            value={additionalWorkNotes}
            onChange={(e) => setAdditionalWorkNotes(e.target.value)}
            placeholder="Décrire le problème supplémentaire identifié"
            rows={2}
            className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setShowAdditionalWork(false)} className={btnGhost}>
              Annuler
            </button>
            <button
              onClick={() =>
                additionalWorkNotes &&
                run(`/api/technicien/work-orders/${workOrderId}/additional-work`, { notes: additionalWorkNotes })
              }
              disabled={loading || !additionalWorkNotes}
              className={btn}
            >
              {loading ? "..." : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
