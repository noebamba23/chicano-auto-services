"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";

const METHODS: { value: Extract<PaymentMethod, "ORANGE_MONEY" | "MOOV_MONEY" | "WAVE">; label: string }[] = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MOOV_MONEY", label: "Moov Money" },
  { value: "WAVE", label: "Wave" },
];

// PAYER — Mobile Money uniquement. Aucun provider n'est réellement connecté
// dans cette phase (voir docs/BILLING.md) : le résultat honnête ("non
// configuré") est affiché, jamais un faux succès.
export function PayButton({ invoiceId, balanceDue }: { invoiceId: string; balanceDue: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("ORANGE_MONEY");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: balanceDue, method }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setResult(data.error ?? "Une erreur est survenue.");
      return;
    }
    if (data.payment?.status === "CONFIRMED") {
      router.refresh();
      setOpen(false);
    } else {
      setResult(
        data.payment?.notes || "Ce mode de paiement n'est pas encore disponible en ligne. Contactez CHICANO pour régler par ce moyen."
      );
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark"
      >
        Payer
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-chicano-gray-light bg-white p-4">
      <p className="text-sm font-semibold text-chicano-black">Payer par Mobile Money</p>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as typeof method)}
        className="mt-3 w-full rounded-md border border-chicano-gray-light px-3 py-2 text-sm text-chicano-black"
      >
        {METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      {result && <p className="mt-3 text-sm text-chicano-gray">{result}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-black"
        >
          Annuler
        </button>
        <button
          onClick={pay}
          disabled={loading}
          className="flex-1 rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "..." : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
