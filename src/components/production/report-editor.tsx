"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEVERITY_OPTIONS } from "@/lib/reports/options";
import type { SeverityLevel } from "@prisma/client";

type Photo = { id: string; url: string; caption: string | null };
type ReportShape = {
  id: string;
  reportNumber: string;
  conclusion: string | null;
  severity: SeverityLevel;
  publishedAt: string | Date | null;
  photos: Photo[];
};

export function ReportEditor({ diagnosticId, report }: { diagnosticId: string; report: ReportShape | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conclusion, setConclusion] = useState(report?.conclusion ?? "");
  const [severity, setSeverity] = useState<SeverityLevel>(report?.severity ?? "NORMAL");
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  async function createReport() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/production/diagnostics/${diagnosticId}/report`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  async function saveDraft() {
    if (!report) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/production/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conclusion, severity }),
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

  async function uploadPhoto(file: File) {
    if (!report) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await fetch(`/api/production/reports/${report.id}/photos`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur d'upload.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  async function removePhoto(photoId: string) {
    if (!report) return;
    setLoading(true);
    await fetch(`/api/production/reports/${report.id}/photos/${photoId}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  async function publish() {
    if (!report) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/production/reports/${report.id}/publish`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    setConfirmingPublish(false);
    router.refresh();
    setLoading(false);
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <button
          onClick={createReport}
          disabled={loading}
          className="rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
        >
          {loading ? "..." : "Créer le rapport"}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  const readOnly = !!report.publishedAt;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-white/50">
        {report.reportNumber} · {readOnly ? "Publié" : "Brouillon"}
      </p>

      <select
        value={severity}
        disabled={readOnly}
        onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
        className="mt-3 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white disabled:opacity-60"
      >
        {SEVERITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="text-black">
            {o.label}
          </option>
        ))}
      </select>

      <textarea
        value={conclusion}
        disabled={readOnly}
        onChange={(e) => setConclusion(e.target.value)}
        placeholder="Conclusion du diagnostic (visible par le client)"
        rows={3}
        className="mt-3 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-60"
      />

      {report.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {report.photos.map((p) => (
            <div key={p.id} className="group relative">
              <img src={p.url} alt={p.caption ?? ""} className="h-20 w-20 rounded object-cover" />
              {!readOnly && (
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <label className="mt-3 block text-xs text-white/60">
          Ajouter une photo de preuve
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            className="mt-1 block text-xs text-white/70"
          />
        </label>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {!readOnly && !confirmingPublish && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={saveDraft}
            disabled={loading}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? "..." : "Enregistrer"}
          </button>
          <button
            onClick={() => setConfirmingPublish(true)}
            className="rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark"
          >
            Publier
          </button>
        </div>
      )}

      {!readOnly && confirmingPublish && (
        <div className="mt-3 rounded-md border border-chicano-red/40 bg-chicano-red/10 p-3">
          <p className="text-sm">Une fois publié, ce rapport ne pourra plus être modifié et sera visible par le client. Confirmer ?</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setConfirmingPublish(false)}
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white"
            >
              Annuler
            </button>
            <button
              onClick={publish}
              disabled={loading}
              className="flex-1 rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "..." : "Confirmer la publication"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
