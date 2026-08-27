"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "reject" | "modify" | null;

export function QuoteResponseActions({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "accept" | "reject" | "request-modification", body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/quotes/${quoteId}/${action}`, {
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

  if (mode === "reject" || mode === "modify") {
    return (
      <div className="rounded-lg border border-chicano-gray-light bg-white p-4">
        <p className="text-sm font-semibold text-chicano-black">
          {mode === "reject" ? "Refuser ce devis" : "Demander une modification"}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === "reject" ? "Motif (facultatif)" : "Précisez ce que vous souhaitez modifier (facultatif)"}
          rows={2}
          className="mt-3 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm text-chicano-black placeholder:text-chicano-gray"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMode(null)}
            className="rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-black"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              mode === "reject" ? run("reject", { reason: note }) : run("request-modification", { note })
            }
            disabled={loading}
            className="flex-1 rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "..." : "Confirmer"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => run("accept", {})}
        disabled={loading}
        className="rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
      >
        {loading ? "..." : "Accepter le devis"}
      </button>
      <button
        onClick={() => setMode("modify")}
        className="rounded-md border border-chicano-gray-light px-4 py-2.5 text-sm font-semibold text-chicano-black hover:border-chicano-red"
      >
        Demander une modification
      </button>
      <button
        onClick={() => setMode("reject")}
        className="rounded-md border border-chicano-gray-light px-4 py-2.5 text-sm font-semibold text-chicano-black hover:border-chicano-red"
      >
        Refuser
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
