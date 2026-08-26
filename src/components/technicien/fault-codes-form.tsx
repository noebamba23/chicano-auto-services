"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FaultCode = {
  id: string;
  code: string;
  device: string | null;
  system: string | null;
  description: string | null;
  recommendation: string | null;
};

export function FaultCodesForm({
  diagnosticId,
  faultCodes,
  readOnly,
}: {
  diagnosticId: string;
  faultCodes: FaultCode[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [device, setDevice] = useState("");
  const [description, setDescription] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!code.trim()) {
      setError("Le code défaut est requis.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/technicien/diagnostics/${diagnosticId}/fault-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        device: device || undefined,
        description: description || undefined,
        recommendation: recommendation || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    setCode("");
    setDevice("");
    setDescription("");
    setRecommendation("");
    setLoading(false);
    router.refresh();
  }

  async function remove(faultCodeId: string) {
    setLoading(true);
    await fetch(`/api/technicien/diagnostics/${diagnosticId}/fault-codes/${faultCodeId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <div className="space-y-2">
        {faultCodes.map((f) => (
          <div key={f.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {f.code} {f.device && <span className="text-white/50">— {f.device}</span>}
                </p>
                {f.description && <p className="mt-1 text-xs text-white/70">{f.description}</p>}
                {f.recommendation && <p className="mt-1 text-xs text-white/50">Recommandation : {f.recommendation}</p>}
              </div>
              {!readOnly && (
                <button
                  onClick={() => remove(f.id)}
                  disabled={loading}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
        ))}
        {faultCodes.length === 0 && <p className="text-xs text-white/50">Aucun code défaut enregistré.</p>}
      </div>

      {!readOnly && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Ajouter un code défaut</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code (ex. P0300)"
              className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <input
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              placeholder="Équipement (facultatif)"
              className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (facultatif)"
            rows={2}
            className="mt-2 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder="Recommandation (facultatif)"
            rows={2}
            className="mt-2 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <button
            onClick={add}
            disabled={loading}
            className="mt-2 rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? "..." : "Ajouter"}
          </button>
        </div>
      )}
    </div>
  );
}
