"use client";

import { useState } from "react";

interface ConsentState {
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
  marketingOptIn: boolean;
}

const LABELS: Record<keyof ConsentState, string> = {
  whatsappOptIn: "Messages WhatsApp",
  emailOptIn: "E-mails",
  smsOptIn: "SMS",
  marketingOptIn: "Offres et actualités CHICANO (marketing)",
};

export function ConsentForm({ initial }: { initial: ConsentState }) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof ConsentState) {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur");
      }
      setSaved(true);
    } catch (e) {
      setState(state);
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-chicano-gray-light bg-white p-6">
      <p className="text-sm font-semibold text-chicano-black">Préférences de communication</p>
      <p className="mt-1 text-xs text-chicano-gray">
        Vos rendez-vous, devis et factures continuent de vous être notifiés normalement. Ces réglages ne concernent que les communications commerciales/marketing.
      </p>
      <div className="mt-4 space-y-3">
        {(Object.keys(LABELS) as (keyof ConsentState)[]).map((key) => (
          <label key={key} className="flex items-center justify-between">
            <span className="text-sm text-chicano-black">{LABELS[key]}</span>
            <input
              type="checkbox"
              checked={state[key]}
              disabled={loading}
              onChange={() => toggle(key)}
              className="h-5 w-5 accent-chicano-red"
            />
          </label>
        ))}
      </div>
      {saved && <p className="mt-3 text-xs text-green-600">Préférences enregistrées.</p>}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
