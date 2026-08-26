"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentStatus } from "@prisma/client";

export function InterventionActions({
  assignmentId,
  status,
  diagnosticId,
}: {
  assignmentId: string;
  // REASSIGNED n'atteint jamais ce composant en pratique — getAssignmentForTechnician()
  // exclut ce statut à la source (voir src/lib/technicians/service.ts) — mais le
  // type Prisma reste le type de champ complet, pas le sous-ensemble filtré.
  status: AssignmentStatus;
  diagnosticId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mileage, setMileage] = useState("");
  const [symptoms, setSymptoms] = useState("");

  async function depart() {
    await run(`/api/technicien/interventions/${assignmentId}/depart`, {});
  }

  async function arrive() {
    await run(`/api/technicien/interventions/${assignmentId}/arrive`, {});
  }

  async function startDiagnostic() {
    const body: Record<string, unknown> = {};
    if (mileage) body.mileageAtVisit = Number(mileage);
    if (symptoms) body.symptoms = symptoms;

    setLoading(true);
    setError(null);
    const res = await fetch(`/api/technicien/interventions/${assignmentId}/start-diagnostic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    router.push(`/technicien/diagnostics/${data.diagnostic.id}`);
  }

  async function run(url: string, body: Record<string, unknown>) {
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
  }

  if (status === "COMPLETED") {
    return diagnosticId ? (
      <a
        href={`/technicien/diagnostics/${diagnosticId}`}
        className="inline-block rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
      >
        Revoir le diagnostic
      </a>
    ) : null;
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      {status === "ASSIGNED" && (
        <button
          onClick={depart}
          disabled={loading}
          className="w-full rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
        >
          {loading ? "..." : "🚗 Je pars"}
        </button>
      )}

      {status === "EN_ROUTE" && (
        <button
          onClick={arrive}
          disabled={loading}
          className="w-full rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
        >
          {loading ? "..." : "📍 Je suis arrivé"}
        </button>
      )}

      {status === "ARRIVED" &&
        (diagnosticId ? (
          <a
            href={`/technicien/diagnostics/${diagnosticId}`}
            className="block w-full rounded-md bg-chicano-red px-4 py-3 text-center text-sm font-semibold text-white hover:bg-chicano-red-dark"
          >
            Continuer le diagnostic
          </a>
        ) : (
          <div>
            <p className="text-sm font-semibold">Démarrer le diagnostic</p>
            <input
              type="number"
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Kilométrage relevé (facultatif)"
              className="mt-3 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Symptômes constatés (facultatif)"
              rows={2}
              className="mt-3 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <button
              onClick={startDiagnostic}
              disabled={loading}
              className="mt-3 w-full rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
            >
              {loading ? "..." : "🔧 Démarrer le diagnostic"}
            </button>
          </div>
        ))}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
