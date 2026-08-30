import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import { getVehicleHistory } from "@/lib/vehicles/history";
import { listPlansForVehicle, listRemindersForVehicle, computeReminderLevel } from "@/lib/maintenance/service";
import { maintenanceTypeLabel, reminderStatusLabel, reminderLevelLabel } from "@/lib/maintenance/options";

// Fiche véhicule côté production (section "FICHE CLIENT" — entretien,
// rappels, historique) : aucune ownership client ici (déjà gardée par
// requireProductionRole au niveau du layout /production), mais scopée à CE
// véhicule uniquement — jamais de vue croisée entre clients.
export default async function ProductionVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vehicle = await db.vehicle.findUnique({
    where: { id },
    include: { customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } } },
  });
  if (!vehicle) notFound();

  const [history, plans, reminders] = await Promise.all([
    getVehicleHistory(id, { limit: 15 }),
    listPlansForVehicle(id),
    listRemindersForVehicle(id),
  ]);

  const activeReminders = reminders
    .filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED")
    .map((r) => ({ ...r, level: computeReminderLevel(r, vehicle.mileage) }));

  return (
    <div>
      <Link href="/production/maintenance" className="text-sm text-white/60 hover:text-white">
        ← Maintenance
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {vehicle.make} {vehicle.model} ({vehicle.chicanoVehicleId})
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {vehicle.customer.user.firstName} {vehicle.customer.user.lastName} — {vehicle.customer.user.phoneE164}
          </p>
          {vehicle.licensePlate && (
            <p className="mt-1 text-sm font-medium">{formatPlateNumber(vehicle.licensePlate)}</p>
          )}
        </div>
        {vehicle.mileage !== null && (
          <p className="text-lg font-bold">{vehicle.mileage.toLocaleString("fr-FR")} km</p>
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Rappels actifs</h2>
        <div className="mt-3 space-y-2">
          {activeReminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
              <span className="text-sm">{maintenanceTypeLabel(r.type)}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                {r.level ? reminderLevelLabel(r.level) : reminderStatusLabel(r.status)}
              </span>
            </div>
          ))}
          {activeReminders.length === 0 && <p className="text-sm text-white/50">Aucun rappel actif.</p>}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Plans d&apos;entretien ({plans.length})</h2>
        <div className="mt-3 space-y-2">
          {plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
              <span className="text-sm">{maintenanceTypeLabel(p.type)}</span>
              <span className="text-xs text-white/50">
                {p.intervalKm ? `${p.intervalKm.toLocaleString("fr-FR")} km` : ""}
                {p.intervalKm && p.intervalMonths ? " / " : ""}
                {p.intervalMonths ? `${p.intervalMonths} mois` : ""}
                {!p.isActive ? " · inactif" : ""}
              </span>
            </div>
          ))}
          {plans.length === 0 && <p className="text-sm text-white/50">Aucun plan d&apos;entretien.</p>}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Historique ({history.total})</h2>
        <div className="mt-3 space-y-2">
          {history.events.map((e) => (
            <div key={e.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-white/50">{new Date(e.date).toLocaleDateString("fr-FR")}</p>
              <p className="text-sm font-medium">{e.title}</p>
              {e.subtitle && <p className="text-xs text-white/50">{e.subtitle}</p>}
            </div>
          ))}
          {history.events.length === 0 && <p className="text-sm text-white/50">Pas encore d&apos;historique disponible.</p>}
        </div>
      </section>
    </div>
  );
}
