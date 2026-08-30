import Link from "next/link";
import { listMaintenanceOverviewForProduction, type MaintenanceWindow } from "@/lib/maintenance/service";
import { maintenanceTypeLabel, reminderLevelLabel } from "@/lib/maintenance/options";

const WINDOWS: { value: MaintenanceWindow | undefined; label: string }[] = [
  { value: undefined, label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "overdue", label: "En retard" },
];

export default async function ProductionMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const { window } = await searchParams;
  const validWindow = (["today", "7d", "30d", "overdue"] as const).includes(window as never)
    ? (window as MaintenanceWindow)
    : undefined;

  const { reminders, vehiclesWithoutPlan } = await listMaintenanceOverviewForProduction(validWindow);

  return (
    <div>
      <h1 className="text-2xl font-bold">Maintenance</h1>
      <p className="mt-1 text-sm text-white/60">{reminders.length} rappel(s) actif(s)</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <Link
            key={w.label}
            href={w.value ? `/production/maintenance?window=${w.value}` : "/production/maintenance"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              validWindow === w.value ? "bg-chicano-red text-white" : "border border-white/20 text-white/70 hover:border-white/40"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {reminders.map((r) => (
          <Link
            key={r.id}
            href={`/production/vehicules/${r.vehicle.id}`}
            className="block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">
                {r.vehicle.make} {r.vehicle.model} ({r.vehicle.chicanoVehicleId})
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.level === "OVERDUE" ? "bg-red-500/20 text-red-300" : r.level === "DUE" ? "bg-amber-500/20 text-amber-300" : "bg-white/10"
                }`}
              >
                {r.level ? reminderLevelLabel(r.level) : "Planifié"}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/70">
              {maintenanceTypeLabel(r.type)} — {r.vehicle.customer?.user?.firstName} {r.vehicle.customer?.user?.lastName}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {r.dueMileage ? `${r.dueMileage.toLocaleString("fr-FR")} km` : ""}
              {r.dueMileage && r.dueAt ? " · " : ""}
              {r.dueAt ? new Date(r.dueAt).toLocaleDateString("fr-FR") : ""}
            </p>
          </Link>
        ))}
        {reminders.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Aucun rappel pour ce filtre.
          </p>
        )}
      </div>

      {vehiclesWithoutPlan.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Véhicules sans plan d&apos;entretien ({vehiclesWithoutPlan.length})
          </h2>
          <div className="mt-3 space-y-2">
            {vehiclesWithoutPlan.map((v) => (
              <Link
                key={v.id}
                href={`/production/vehicules/${v.id}`}
                className="block rounded-lg border border-white/10 bg-white/5 p-3 text-sm hover:border-white/30"
              >
                {v.make} {v.model} ({v.chicanoVehicleId})
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
