"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/maintenance/options";
import type { MaintenanceType } from "@prisma/client";

// Rattache une ligne de travaux au carnet d'entretien (Phase 8) — c'est ce
// rattachement qui permet à completeMaintenanceFromWorkOrder() de clore le
// bon rappel une fois le Work Order terminé (voir docs/MAINTENANCE.md).
export function WorkOrderItemMaintenanceSelect({
  workOrderId,
  itemId,
  value,
}: {
  workOrderId: string;
  itemId: string;
  value: MaintenanceType | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onChange(next: string) {
    setLoading(true);
    await fetch(`/api/production/work-orders/${workOrderId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenanceType: next || null }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="rounded-md border border-white/20 bg-chicano-black px-2 py-1 text-xs text-white disabled:opacity-60"
    >
      <option value="">— Entretien —</option>
      {Object.entries(MAINTENANCE_TYPE_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
