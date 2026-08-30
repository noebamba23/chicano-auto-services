"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkOrderStatus } from "@prisma/client";

export function WorkOrderActions({
  workOrderId,
  status,
  technicians,
  currentTechnicianId,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
  technicians: { id: string; user: { firstName: string; lastName: string } }[];
  currentTechnicianId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [technicianId, setTechnicianId] = useState(currentTechnicianId ?? "");
  const [showFail, setShowFail] = useState(false);
  const [failNotes, setFailNotes] = useState("");

  async function run(action: string, body: Record<string, unknown> = {}) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/production/work-orders/${workOrderId}/${action}`, {
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
    setShowFail(false);
  }

  const btn = "rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60";
  const btnGhost = "rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      {(status === "READY" || status === "SCHEDULED") && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-white/50">Date planifiée</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="mt-1 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            onClick={() => scheduledDate && run("schedule", { scheduledDate })}
            disabled={loading || !scheduledDate}
            className={btn}
          >
            {loading ? "..." : "📅 Planifier"}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-white/50">Technicien</label>
          <select
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="mt-1 rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white"
          >
            <option value="">— Choisir —</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user.firstName} {t.user.lastName}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => technicianId && run("assign-technician", { technicianId })}
          disabled={loading || !technicianId || technicianId === currentTechnicianId}
          className={btnGhost}
        >
          {loading ? "..." : "👤 Affecter"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "SCHEDULED" && (
          <button onClick={() => run("start")} disabled={loading} className={btn}>
            {loading ? "..." : "▶️ Démarrer"}
          </button>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <button onClick={() => run("pause")} disabled={loading} className={btnGhost}>
              {loading ? "..." : "⏸️ Mettre en pause"}
            </button>
            <button onClick={() => run("waiting-parts")} disabled={loading} className={btnGhost}>
              {loading ? "..." : "🔩 En attente de pièces"}
            </button>
            <button onClick={() => run("quality-check")} disabled={loading} className={btn}>
              {loading ? "..." : "✅ Envoyer au contrôle"}
            </button>
          </>
        )}

        {(status === "WAITING_PARTS" || status === "ON_HOLD") && (
          <button onClick={() => run("resume")} disabled={loading} className={btn}>
            {loading ? "..." : "▶️ Reprendre"}
          </button>
        )}

        {status === "QUALITY_CHECK" && !showFail && (
          <>
            <button onClick={() => run("quality-check/pass")} disabled={loading} className={btn}>
              {loading ? "..." : "🏁 Valider (terminer)"}
            </button>
            <button onClick={() => setShowFail(true)} disabled={loading} className={btnGhost}>
              Contrôle non concluant
            </button>
          </>
        )}

        {status === "QUALITY_CHECK" && showFail && (
          <div className="w-full">
            <textarea
              value={failNotes}
              onChange={(e) => setFailNotes(e.target.value)}
              placeholder="Motif du contrôle non concluant"
              rows={2}
              className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <div className="mt-2 flex gap-2">
              <button onClick={() => setShowFail(false)} className={btnGhost}>
                Annuler
              </button>
              <button
                onClick={() => failNotes && run("quality-check/fail", { notes: failNotes })}
                disabled={loading || !failNotes}
                className={btn}
              >
                {loading ? "..." : "Renvoyer en travaux"}
              </button>
            </div>
          </div>
        )}

        {status !== "COMPLETED" && status !== "CANCELLED" && (
          <button onClick={() => run("cancel")} disabled={loading} className={btnGhost}>
            {loading ? "..." : "✕ Annuler"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
