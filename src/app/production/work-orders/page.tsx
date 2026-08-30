import Link from "next/link";
import { listWorkOrdersForProduction } from "@/lib/work-orders/service";
import { workOrderStatusLabel } from "@/lib/work-orders/options";
import type { WorkOrderStatus } from "@prisma/client";

const COLUMNS: { status: WorkOrderStatus; label: string }[] = [
  { status: "READY", label: "Nouveaux / Prêts" },
  { status: "SCHEDULED", label: "Planifiés" },
  { status: "IN_PROGRESS", label: "En cours" },
  { status: "WAITING_PARTS", label: "En attente de pièces" },
  { status: "QUALITY_CHECK", label: "Contrôle qualité" },
  { status: "COMPLETED", label: "Terminés" },
];

export default async function ProductionWorkOrdersPage() {
  const workOrders = await listWorkOrdersForProduction();
  const byStatus = new Map<WorkOrderStatus, typeof workOrders>();
  for (const wo of workOrders) {
    byStatus.set(wo.status, [...(byStatus.get(wo.status) ?? []), wo]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Work Orders</h1>
      <p className="mt-1 text-sm text-white/60">{workOrders.length} ordre(s) de réparation</p>

      <div className="mt-6 space-y-8">
        {COLUMNS.map((col) => {
          const rows = byStatus.get(col.status) ?? [];
          if (rows.length === 0) return null;
          return (
            <section key={col.status}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                {col.label} ({rows.length})
              </h2>
              <div className="mt-3 space-y-2">
                {rows.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/production/work-orders/${wo.id}`}
                    className="block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{wo.workOrderNumber}</p>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{workOrderStatusLabel(wo.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/70">
                      {wo.customer?.user.firstName} {wo.customer?.user.lastName} — {wo.vehicle.make} {wo.vehicle.model}
                      {wo.priority === "URGENT" ? " · 🔴 Urgent" : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        {workOrders.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Aucun ordre de réparation pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
