"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    if (!confirm("Annuler cette demande ?")) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/service-requests/${requestId}/cancel`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible d'annuler cette demande.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={onCancel}
        disabled={loading}
        className="rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-gray hover:border-chicano-red hover:text-chicano-red disabled:opacity-60"
      >
        {loading ? "..." : "Annuler ma demande"}
      </button>
      {error && <p className="mt-2 text-sm text-chicano-red">{error}</p>}
    </div>
  );
}
