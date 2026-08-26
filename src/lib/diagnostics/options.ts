import type { CheckCategory, CheckResult, DiagnosticStatus } from "@prisma/client";

// Source unique des libellés du module diagnostic (Phase 5) — même principe
// que src/lib/vehicles/options.ts et src/lib/service-requests/options.ts.

export const CHECK_CATEGORY_OPTIONS: { value: CheckCategory; label: string }[] = [
  { value: "ENGINE", label: "Moteur" },
  { value: "TRANSMISSION", label: "Transmission" },
  { value: "BRAKING", label: "Freinage" },
  { value: "SUSPENSION", label: "Suspension" },
  { value: "STEERING", label: "Direction" },
  { value: "ELECTRICAL", label: "Électricité" },
  { value: "ELECTRONICS", label: "Électronique" },
  { value: "AIR_CONDITIONING", label: "Climatisation" },
  { value: "BATTERY", label: "Batterie" },
  { value: "SAFETY", label: "Sécurité" },
];

export const CHECK_RESULT_OPTIONS: { value: CheckResult; label: string }[] = [
  { value: "NOT_CHECKED", label: "Non vérifié" },
  { value: "NORMAL", label: "Normal" },
  { value: "TO_MONITOR", label: "À surveiller" },
  { value: "ANOMALY", label: "Anomalie" },
  { value: "CRITICAL", label: "Critique" },
];

const categoryLabels = new Map(CHECK_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const resultLabels = new Map(CHECK_RESULT_OPTIONS.map((o) => [o.value, o.label]));

export function checkCategoryLabel(value: CheckCategory) {
  return categoryLabels.get(value) ?? value;
}

export function checkResultLabel(value: CheckResult) {
  return resultLabels.get(value) ?? value;
}

export const DIAGNOSTIC_STATUS_LABELS: Record<DiagnosticStatus, string> = {
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  REPORT_PUBLISHED: "Rapport publié",
};

export function diagnosticStatusLabel(value: DiagnosticStatus) {
  return DIAGNOSTIC_STATUS_LABELS[value] ?? value;
}

// Couleur indicative du résultat (section "CHECKLIST" — un client ne verra
// jamais cette vue technicien, mais la production oui, en lecture seule,
// dans /production/demandes/[id]).
export function checkResultTone(value: CheckResult): "neutral" | "ok" | "warn" | "danger" {
  if (value === "NORMAL") return "ok";
  if (value === "TO_MONITOR") return "warn";
  if (value === "ANOMALY" || value === "CRITICAL") return "danger";
  return "neutral";
}
