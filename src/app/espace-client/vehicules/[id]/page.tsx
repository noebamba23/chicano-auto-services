import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, getVehicleForCustomer, VehicleNotFoundError } from "@/lib/vehicles/service";
import { bodyTypeLabel, fuelTypeLabel, transmissionLabel } from "@/lib/vehicles/options";
import { VehicleActions } from "@/components/vehicles/vehicle-actions";

const COMING_SOON_SECTIONS = [
  { id: "historique", title: "Historique" },
  { id: "diagnostics", title: "Diagnostics" },
  { id: "rapports", title: "Rapports" },
  { id: "devis", title: "Devis" },
  { id: "reparations", title: "Réparations" },
  { id: "factures", title: "Factures" },
  { id: "maintenance", title: "Maintenance" },
  { id: "rappels", title: "Rappels" },
];

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

  const identity = [
    ["Marque", vehicle.make],
    ["Modèle", vehicle.model],
    ["Version", vehicle.trim],
    ["Année", vehicle.year],
    ["Type", bodyTypeLabel(vehicle.bodyType)],
    ["Immatriculation", vehicle.licensePlate],
    ["VIN", vehicle.vin ?? "Non renseigné"],
    ["Kilométrage", vehicle.mileage !== null ? `${vehicle.mileage.toLocaleString("fr-FR")} km` : null],
    ["Carburant", fuelTypeLabel(vehicle.fuelType)],
    ["Motorisation", vehicle.engine],
    ["Boîte de vitesses", transmissionLabel(vehicle.transmission)],
    ["Couleur", vehicle.color],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  return (
    <div>
      <Link href="/espace-client/vehicules" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes véhicules
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
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
          <p className="mt-1 text-sm text-chicano-gray">{vehicle.chicanoVehicleId}</p>
        </div>
        <VehicleActions vehicleId={vehicle.id} isPrimary={vehicle.isPrimary} />
      </div>

      <section className="mt-8 rounded-lg border border-chicano-gray-light bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Identité</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {identity.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-chicano-gray">{label}</dt>
              <dd className="text-sm font-medium text-chicano-black">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COMING_SOON_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-20 rounded-lg border border-dashed border-chicano-gray-light bg-white p-5"
          >
            <p className="font-semibold text-chicano-black">{section.title}</p>
            <p className="mt-2 text-sm text-chicano-gray">Bientôt disponible.</p>
          </section>
        ))}
      </div>
    </div>
  );
}
