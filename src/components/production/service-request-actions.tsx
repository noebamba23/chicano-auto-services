"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_SLOTS } from "@/lib/service-requests/options";

type Mode = "accept" | "reject" | "reschedule" | null;

export function ServiceRequestActions({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAct = ["SUBMITTED", "UNDER_REVIEW", "RESCHEDULE_REQUESTED"].includes(status);
  if (!canAct) return null;

  async function submitAccept() {
    if (!date || !slot) {
      setError("Date et créneau requis.");
      return;
    }
    await run("accept", { scheduledDate: date, scheduledSlot: slot, notes });
  }

  async function submitReschedule() {
    if (!date || !slot) {
      setError("Date et créneau requis.");
      return;
    }
    await run("reschedule", { scheduledDate: date, scheduledSlot: slot, notes });
  }

  async function submitReject() {
    await run("reject", { reason });
  }

  async function run(action: "accept" | "reject" | "reschedule", body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/service-requests/${requestId}/${action}`, {
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
    setMode(null);
    router.refresh();
    setLoading(false);
  }

  if (mode === "accept" || mode === "reschedule") {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold">
          {mode === "accept" ? "Accepter et confirmer un créneau" : "Proposer un autre créneau"}
        </p>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="mt-3 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SERVICE_SLOTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSlot(s.value)}
              className={`rounded-md border px-2 py-2 text-xs ${
                slot === s.value ? "border-chicano-red bg-chicano-red/20 text-white" : "border-white/20 text-white/80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (facultatif)"
          rows={2}
          className="mt-3 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMode(null)}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white"
          >
            Annuler
          </button>
          <button
            onClick={mode === "accept" ? submitAccept : submitReschedule}
            disabled={loading}
            className="flex-1 rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "..." : "Confirmer"}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold">Refuser la demande</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif (facultatif, transmis au client)"
          rows={2}
          className="mt-3 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMode(null)}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white"
          >
            Annuler
          </button>
          <button
            onClick={submitReject}
            disabled={loading}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "..." : "Confirmer le refus"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setMode("accept")}
        className="rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark"
      >
        Accepter
      </button>
      <button
        onClick={() => setMode("reject")}
        className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
      >
        Refuser
      </button>
      <button
        onClick={() => setMode("reschedule")}
        className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
      >
        Demander autre créneau
      </button>
    </div>
  );
}
