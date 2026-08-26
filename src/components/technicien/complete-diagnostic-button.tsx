"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompleteDiagnosticButton({ diagnosticId }: { diagnosticId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/technicien/diagnostics/${diagnosticId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={complete}
        disabled={loading}
        className="w-full rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
      >
        {loading ? "..." : "✅ Terminer le diagnostic"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
