"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHECK_CATEGORY_OPTIONS, CHECK_RESULT_OPTIONS, checkResultTone } from "@/lib/diagnostics/options";
import type { CheckCategory, CheckResult } from "@prisma/client";

type CheckRow = { category: CheckCategory; result: CheckResult; observation: string | null };

const TONE_CLASSES: Record<string, string> = {
  neutral: "border-white/20 text-white/60",
  ok: "border-emerald-500/40 text-emerald-400",
  warn: "border-amber-500/40 text-amber-400",
  danger: "border-red-500/40 text-red-400",
};

export function DiagnosticChecklist({
  diagnosticId,
  checks,
  readOnly,
}: {
  diagnosticId: string;
  checks: CheckRow[];
  readOnly: boolean;
}) {
  const byCategory = new Map(checks.map((c) => [c.category, c]));

  return (
    <div className="space-y-3">
      {CHECK_CATEGORY_OPTIONS.map((opt) => (
        <ChecklistRow
          key={opt.value}
          diagnosticId={diagnosticId}
          category={opt.value}
          label={opt.label}
          current={byCategory.get(opt.value) ?? null}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

function ChecklistRow({
  diagnosticId,
  category,
  label,
  current,
  readOnly,
}: {
  diagnosticId: string;
  category: CheckCategory;
  label: string;
  current: CheckRow | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<CheckResult>(current?.result ?? "NOT_CHECKED");
  const [observation, setObservation] = useState(current?.observation ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setLoading(true);
    setSaved(false);
    const res = await fetch(`/api/technicien/diagnostics/${diagnosticId}/checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, result, observation: observation || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const tone = checkResultTone(result);

  return (
    <div className={`rounded-lg border p-3 ${TONE_CLASSES[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{label}</p>
        <select
          value={result}
          disabled={readOnly}
          onChange={(e) => {
            setResult(e.target.value as CheckResult);
            setSaved(false);
          }}
          className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          {CHECK_RESULT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="text-black">
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {!readOnly && (
        <textarea
          value={observation}
          onChange={(e) => {
            setObservation(e.target.value);
            setSaved(false);
          }}
          placeholder="Observation (facultatif)"
          rows={1}
          className="mt-2 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs text-white placeholder:text-white/40"
        />
      )}
      {readOnly && observation && <p className="mt-2 text-xs text-white/70">{observation}</p>}
      {!readOnly && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={save}
            disabled={loading}
            className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? "..." : "Enregistrer"}
          </button>
          {saved && <span className="text-xs text-emerald-400">Enregistré</span>}
        </div>
      )}
    </div>
  );
}
