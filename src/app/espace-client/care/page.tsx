import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, listVehiclesForCustomer } from "@/lib/vehicles/service";
import { listCareSubscriptionsForCustomer } from "@/lib/crm/care";
import { getVehicleMaintenanceForCustomer } from "@/lib/maintenance/service";
import { maintenanceTypeLabel } from "@/lib/maintenance/options";
import { formatXOF } from "@/lib/billing/options";
import { ReminderAppointmentButton } from "@/components/maintenance/reminder-appointment-button";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  PAUSED: "Suspendu",
  CANCELLED: "Résilié",
  EXPIRED: "Expiré",
};

export default async function ClientCarePage() {
  const session = await getSession();
  const customerId = session ? await getCustomerIdForUser(session.sub) : null;
  const subscriptions = customerId ? await listCareSubscriptionsForCustomer(customerId) : [];
  const vehicles = customerId ? await listVehiclesForCustomer(customerId) : [];

  const remindersByVehicle = customerId
    ? await Promise.all(vehicles.map((v) => getVehicleMaintenanceForCustomer(customerId, v.id).then((m) => ({ vehicle: v, ...m }))))
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">CHICANO CARE</h1>
      <p className="mt-1 text-sm text-chicano-gray">Votre programme d&apos;entretien préventif.</p>

      <div className="mt-6 space-y-4">
        {subscriptions.map((s) => (
          <div key={s.id} className="rounded-lg border border-chicano-gray-light bg-white p-6">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-chicano-black">{s.carePlan.name}</p>
              <span className="rounded-full bg-chicano-gray-light px-3 py-1 text-xs font-semibold text-chicano-black">
                {STATUS_LABELS[s.status] ?? s.status}
              </span>
            </div>
            {s.carePlan.description && <p className="mt-2 text-sm text-chicano-gray">{s.carePlan.description}</p>}
            {s.carePlan.includedServices.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-sm text-chicano-gray">
                {s.carePlan.includedServices.map((svc: string) => <li key={svc}>{svc}</li>)}
              </ul>
            )}
            <p className="mt-3 text-sm text-chicano-black">
              {formatXOF(s.carePlan.price)} · début le {new Date(s.startedAt).toLocaleDateString("fr-FR")}
              {s.endedAt ? ` · fin le ${new Date(s.endedAt).toLocaleDateString("fr-FR")}` : ""}
            </p>
            {s.vehicle && <p className="mt-1 text-sm text-chicano-gray">Véhicule : {s.vehicle.make} {s.vehicle.model}</p>}
          </div>
        ))}

        {subscriptions.length === 0 && (
          <div className="rounded-lg border border-chicano-gray-light bg-white p-6 text-center">
            <p className="text-sm text-chicano-gray">
              Vous n&apos;avez pas encore d&apos;abonnement CHICANO CARE. Contactez notre équipe lors de votre prochaine visite pour en savoir plus.
            </p>
          </div>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-chicano-black">Prochains entretiens</h2>
      <div className="mt-3 space-y-3">
        {remindersByVehicle.map(({ vehicle, reminders }) =>
          reminders.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-chicano-gray-light bg-white p-4">
              <div>
                <p className="font-semibold text-chicano-black">{maintenanceTypeLabel(r.type)}</p>
                <p className="text-sm text-chicano-gray">
                  {vehicle.make} {vehicle.model}
                  {r.dueAt ? ` — ${new Date(r.dueAt).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </div>
              <ReminderAppointmentButton reminderId={r.id} />
            </div>
          ))
        )}
        {remindersByVehicle.every((r) => r.reminders.length === 0) && (
          <p className="rounded-lg border border-chicano-gray-light bg-white p-6 text-center text-sm text-chicano-gray">
            🟢 Tous vos entretiens sont à jour.
          </p>
        )}
      </div>
    </div>
  );
}
