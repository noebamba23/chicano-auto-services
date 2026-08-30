"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus, PaymentMethod } from "@prisma/client";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Espèces" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MOOV_MONEY", label: "Moov Money" },
  { value: "WAVE", label: "Wave" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
  { value: "OTHER", label: "Autre" },
];

export function InvoiceActions({
  invoiceId,
  status,
  balanceDue,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  balanceDue: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState(String(balanceDue));
  const [method, setMethod] = useState<PaymentMethod>("CASH");

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
    setShowPayment(false);
  }

  const btn = "rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60";
  const btnGhost = "rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60";

  if (status === "PAID" || status === "CANCELLED") return null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <button onClick={() => run(`/api/production/billing/${invoiceId}/issue`)} disabled={loading} className={btn}>
            {loading ? "..." : "📤 Émettre la facture"}
          </button>
        )}

        {status !== "DRAFT" && !showPayment && (
          <button onClick={() => setShowPayment(true)} disabled={loading} className={btn}>
            💰 Enregistrer un paiement
          </button>
        )}

        <button onClick={() => run(`/api/production/billing/${invoiceId}/cancel`)} disabled={loading} className={btnGhost}>
          {loading ? "..." : "✕ Annuler"}
        </button>
      </div>

      {showPayment && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-white/50">Montant (F CFA)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-32 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50">Méthode</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="mt-1 rounded-md border border-white/20 bg-chicano-black px-3 py-2 text-sm text-white"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => run(`/api/production/billing/${invoiceId}/payments`, { amount: Number(amount), method })}
              disabled={loading || !amount || Number(amount) <= 0}
              className={btn}
            >
              {loading ? "..." : "Confirmer"}
            </button>
            <button onClick={() => setShowPayment(false)} className={btnGhost}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
