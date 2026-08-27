import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getCustomerIdForUser,
  getVehicleForCustomer,
  listVehiclesForCustomer,
  VehicleNotFoundError,
} from "@/lib/vehicles/service";
import { ServiceRequestWizard } from "@/components/service-requests/service-request-wizard";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";

const TYPE_TO_CATEGORY: Record<string, string> = {
  diagnostic: "DIAGNOSTIC",
  entretien: "MAINTENANCE",
};

export default async function DemandeServicePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; type?: string }>;
}) {
  const { vehicleId, type } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/connexion?next=/espace-client/demande-service");

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  if (!vehicleId) {
    const vehicles = await listVehiclesForCustomer(customerId);
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-bold text-chicano-black">Demander un service</h1>
        <p className="mt-1 text-sm text-chicano-gray">Choisissez d&apos;abord le véhicule concerné.</p>

        {vehicles.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-chicano-gray-light bg-white p-8 text-center">
            <p className="text-sm text-chicano-gray">Ajoutez d&apos;abord un véhicule pour demander un service.</p>
            <Link
              href="/espace-client/vehicules/nouveau"
              className="mt-4 inline-block rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark"
            >
              + Ajouter un véhicule
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/espace-client/demande-service?vehicleId=${v.id}${type ? `&type=${type}` : ""}`}
                className="block rounded-lg border border-chicano-gray-light bg-white p-4 hover:border-chicano-red"
              >
                <p className="font-semibold text-chicano-black">
                  {v.make} {v.model}
                </p>
                {v.licensePlate && (
                  <p className="text-sm font-medium text-chicano-black">{formatPlateNumber(v.licensePlate)}</p>
                )}
                <p className="text-xs text-chicano-gray">{v.chicanoVehicleId}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  let vehicle;
  try {
    vehicle = await getVehicleForCustomer(customerId, vehicleId);
  } catch (err) {
    if (err instanceof VehicleNotFoundError) notFound();
    throw err;
  }

  if (vehicle.status !== "ACTIVE") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-3xl">🚗</p>
        <h1 className="mt-4 text-xl font-bold text-chicano-black">Véhicule archivé</h1>
        <p className="mt-2 text-sm text-chicano-gray">
          Ce véhicule est archivé et ne peut pas faire l&apos;objet d&apos;une nouvelle demande.
        </p>
        <Link
          href="/espace-client/vehicules"
          className="mt-6 inline-block rounded-md border border-chicano-gray-light px-5 py-2.5 text-sm font-semibold text-chicano-black hover:border-chicano-red"
        >
          Retour à mes véhicules
        </Link>
      </div>
    );
  }

  const initialCategory = type ? TYPE_TO_CATEGORY[type] : undefined;

  return <ServiceRequestWizard vehicle={vehicle} initialCategory={initialCategory} />;
}
