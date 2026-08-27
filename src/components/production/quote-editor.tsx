"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quoteStatusLabel, formatXOF } from "@/lib/quotes/options";
import type { QuoteStatus, Prisma } from "@prisma/client";

// Les montants viennent de colonnes Prisma Decimal (@db.Decimal) — ni
// number ni string côté runtime, mais Prisma.Decimal (compatible avec
// Number()/formatXOF()).
type Amount = string | number | Prisma.Decimal | null;

type Item = { label: string; quantity: string; unitPrice: string };
type QuoteItem = { id: string; label: string; quantity: Amount; unitPrice: Amount };
type QuoteVersion = {
  versionNumber: number;
  laborAmount: Amount;
  travelAmount: Amount;
  discountAmount: Amount;
  totalAmount: Amount;
  leadTimeDays: number | null;
  terms: string | null;
  items: QuoteItem[];
};
type QuoteShape = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  currentVersion: number;
  totalAmount: Amount;
  versions: QuoteVersion[];
};

const EMPTY_ITEM: Item = { label: "", quantity: "1", unitPrice: "" };

export function QuoteEditor({ diagnosticId, quote }: { diagnosticId: string; quote: QuoteShape | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFreshForm, setShowFreshForm] = useState(false);
  const [items, setItems] = useState<Item[]>([EMPTY_ITEM]);
  const [laborAmount, setLaborAmount] = useState("");
  const [travelAmount, setTravelAmount] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [terms, setTerms] = useState("");

  const needsForm = !quote || quote.status === "MODIFICATION_REQUESTED" || showFreshForm;

  function updateItem(index: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    const parsedItems = items
      .filter((it) => it.label.trim() && it.unitPrice)
      .map((it) => ({ label: it.label.trim(), quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) }));

    if (parsedItems.length === 0) {
      setError("Ajoutez au moins une ligne avec un libellé et un prix.");
      return;
    }

    const body = {
      items: parsedItems,
      laborAmount: laborAmount ? Number(laborAmount) : undefined,
      travelAmount: travelAmount ? Number(travelAmount) : undefined,
      leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
      terms: terms || undefined,
    };

    setLoading(true);
    setError(null);
    const url =
      quote && quote.status === "MODIFICATION_REQUESTED"
        ? `/api/production/quotes/${quote.id}/versions`
        : `/api/production/diagnostics/${diagnosticId}/quote`;
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
  }

  async function sendToClient() {
    if (!quote) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/production/quotes/${quote.id}/send`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  if (needsForm) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        {quote?.status === "MODIFICATION_REQUESTED" && (
          <p className="mb-3 text-sm text-amber-400">Le client a demandé une modification — préparez une nouvelle version.</p>
        )}
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={item.label}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                placeholder="Prestation / pièce"
                className="min-w-[160px] flex-1 rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
                placeholder="Qté"
                className="w-16 rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
              />
              <input
                type="number"
                value={item.unitPrice}
                onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                placeholder="Prix unitaire (F CFA)"
                className="w-40 rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
              />
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-300">
                  Retirer
                </button>
              )}
            </div>
          ))}
          <button onClick={addItem} className="text-xs text-white/60 hover:text-white">
            + Ajouter une ligne
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            type="number"
            value={laborAmount}
            onChange={(e) => setLaborAmount(e.target.value)}
            placeholder="Main d'œuvre (F CFA)"
            className="rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
          />
          <input
            type="number"
            value={travelAmount}
            onChange={(e) => setTravelAmount(e.target.value)}
            placeholder="Déplacement (F CFA)"
            className="rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
          />
          <input
            type="number"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
            placeholder="Délai (jours)"
            className="rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40"
          />
        </div>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="Conditions (facultatif)"
          rows={2}
          className="mt-2 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
        />

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="mt-3 rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
        >
          {loading ? "..." : quote?.status === "MODIFICATION_REQUESTED" ? "Envoyer la nouvelle version" : "Créer le devis"}
        </button>
      </div>
    );
  }

  const latestVersion = quote!.versions[quote!.versions.length - 1];

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">
          {quote!.quoteNumber} · v{quote!.currentVersion}
        </p>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{quoteStatusLabel(quote!.status)}</span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {latestVersion.items.map((it) => (
          <li key={it.id} className="flex justify-between text-white/80">
            <span>
              {it.label} × {Number(it.quantity)}
            </span>
            <span>{formatXOF(Number(it.unitPrice) * Number(it.quantity))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-sm font-semibold">Total : {formatXOF(quote!.totalAmount)}</p>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {quote!.status === "DRAFT" && (
        <button
          onClick={sendToClient}
          disabled={loading}
          className="mt-3 rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
        >
          {loading ? "..." : "Envoyer au client"}
        </button>
      )}

      {quote!.status === "REJECTED" && (
        <div className="mt-3">
          <p className="text-xs text-white/50">Devis refusé.</p>
          <button
            onClick={() => setShowFreshForm(true)}
            className="mt-2 rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Créer un nouveau devis
          </button>
        </div>
      )}
    </div>
  );
}
