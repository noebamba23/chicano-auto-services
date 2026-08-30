import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, getVehicleForCustomer, VehicleNotFoundError } from "@/lib/vehicles/service";
import { bodyTypeLabel, fuelTypeLabel, transmissionLabel } from "@/lib/vehicles/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import { VehicleActions } from "@/components/vehicles/vehicle-actions";
import { VehiclePhotoUploader } from "@/components/vehicles/vehicle-photo-uploader";
import { VehicleHistoryTimeline } from "@/components/vehicles/vehicle-history-timeline";
import { getVehicleMaintenanceForCustomer } from "@/lib/maintenance/service";
import { maintenanceTypeLabel, reminderLevelLabel } from "@/lib/maintenance/options";
import { ReminderAppointmentButton } from "@/components/maintenance/reminder-appointment-button";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/vehicules/${id}`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let vehicle;
  try {
    vehicle = await getVehicleForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof VehicleNotFoundError) notFound();
    throw err;
  }

  const { reminders } = await getVehicleMaintenanceForCustomer(customerId, id);
  const nextReminder = reminders[0] ?? null;

  const metaLine = [vehicle.year, fuelTypeLabel(vehicle.fuelType), transmissionLabel(vehicle.transmission)]
    .filter(Boolean)
    .join(" • ");

  const identity = [
    ["Marque", vehicle.make],
    ["Modèle", vehicle.model],
    ["Version", vehicle.trim],
    ["Année", vehicle.year],
    ["Type", bodyTypeLabel(vehicle.bodyType)],
    ["VIN", vehicle.vin ?? "Non renseigné"],
    ["Immatriculation", formatPlateNumber(vehicle.licensePlate)],
    ["Kilométrage", vehicle.mileage !== null ? `${vehicle.mileage.toLocaleString("fr-FR")} km` : null],
    ["Motorisation", vehicle.engine],
    ["Boîte de vitesses", transmissionLabel(vehicle.transmission)],
    ["Couleur", vehicle.color],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  return (
    <div>
      <Link href="/espace-client/vehicules" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes véhicules
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <VehiclePhotoUploader vehicleId={vehicle.id} coverUrl={vehicle.photos[0]?.url} />

        <div className="flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-chicano-black">
                  {vehicle.make} {vehicle.model}
                </h1>
                {vehicle.isPrimary && (
                  <span className="rounded-full bg-chicano-red/10 px-2 py-1 text-xs font-semibold text-chicano-red">
                    Principal
                  </span>
                )}
              </div>
              {metaLine && <p className="mt-1 text-sm text-chicano-gray">{metaLine}</p>}
              <p className="mt-1 text-sm font-medium text-chicano-black">{vehicle.chicanoVehicleId}</p>
            </div>
          </div>

          <div className="mt-4">
            <VehicleActions vehicleId={vehicle.id} isPrimary={vehicle.isPrimary} />
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-chicano-gray-light bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Informations</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {identity.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-chicano-gray">{label}</dt>
              <dd className="text-sm font-medium text-chicano-black">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href={`/espace-client/demande-service?vehicleId=${vehicle.id}&type=diagnostic`}
            className="rounded-md bg-chicano-red px-4 py-3 text-center text-sm font-semibold text-white hover:bg-chicano-red-dark"
          >
            Demander un diagnostic
          </Link>
          <Link
            href={`/espace-client/demande-service?vehicleId=${vehicle.id}&type=entretien`}
            className="rounded-md border border-chicano-gray-light px-4 py-3 text-center text-sm font-semibold text-chicano-black hover:border-chicano-red"
          >
            Entretien
          </Link>
          <Link
            href={`/urgence?vehicleId=${vehicle.id}`}
            className="rounded-md border border-chicano-gray-light px-4 py-3 text-center text-sm font-semibold text-chicano-black hover:border-chicano-red"
          >
            Assistance
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Entretien du véhicule</h2>
        {nextReminder ? (
          <div className="mt-4 rounded-lg border border-chicano-gray-light bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-chicano-gray">Prochain entretien</p>
                <p className="mt-1 text-lg font-bold text-chicano-black">{maintenanceTypeLabel(nextReminder.type)}</p>
                <p className="mt-1 text-sm text-chicano-gray">
                  {nextReminder.dueMileage ? `${nextReminder.dueMileage.toLocaleString("fr-FR")} km` : ""}
                  {nextReminder.dueMileage && nextReminder.dueAt ? " ou " : ""}
                  {nextReminder.dueAt ? new Date(nextReminder.dueAt).toLocaleDateString("fr-FR") : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  nextReminder.level === "OVERDUE"
                    ? "bg-red-100 text-red-700"
                    : nextReminder.level === "DUE"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-chicano-gray-light text-chicano-black"
                }`}
              >
                {nextReminder.level ? reminderLevelLabel(nextReminder.level) : "À jour"}
              </span>
            </div>
            <div className="mt-4">
              <ReminderAppointmentButton reminderId={nextReminder.id} />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-chicano-gray-light bg-white p-6 text-center">
            <p className="text-sm text-chicano-gray">🟢 Aucun entretien à prévoir pour le moment.</p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Historique du véhicule</h2>
        <div className="mt-4">
          <VehicleHistoryTimeline vehicleId={vehicle.id} />
        </div>
      </section>
    </div>
  );
}
