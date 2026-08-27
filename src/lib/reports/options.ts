import type { SeverityLevel } from "@prisma/client";

export const SEVERITY_OPTIONS: { value: SeverityLevel; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "TO_MONITOR", label: "À surveiller" },
  { value: "UPCOMING", label: "À prévoir" },
  { value: "URGENT", label: "Urgent" },
];

const severityLabels = new Map(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));

export function severityLabel(value: SeverityLevel) {
  return severityLabels.get(value) ?? value;
}

export function severityTone(value: SeverityLevel): "ok" | "warn" | "danger" {
  if (value === "URGENT") return "danger";
  if (value === "UPCOMING" || value === "TO_MONITOR") return "warn";
  return "ok";
}
