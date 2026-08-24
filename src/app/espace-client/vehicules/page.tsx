import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, listVehiclesForCustomer } from "@/lib/vehicles/service";
import { VehicleCard } from "@/components/vehicles/vehicle-card";

export default async function VehiclesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/espace-client/vehicules");

  const customerId = await getCustomerIdForUser(session.sub);
  const vehicles = customerId ? await listVehiclesForCustomer(customerId) : [];
  const primary = vehicles.find((v) => v.isPrimary);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">Mes véhicules</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {vehicles.length === 0
              ? "Aucun véhicule enregistré."
              : `${vehicles.length} véhicule${vehicles.length > 1 ? "s" : ""} enregistré${vehicles.length > 1 ? "s" : ""}${
                  primary ? ` — véhicule principal : ${primary.make} ${primary.model}` : ""
                }`}
          </p>
        </div>
        <Link
          href="/espace-client/vehicules/nouveau"
          className="rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark"
        >
          + Ajouter un véhicule
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-chicano-gray-light bg-white p-8 text-center">
          <p className="text-3xl">🚗</p>
          <p className="mt-3 text-sm text-chicano-gray">
            Ajoutez votre premier véhicule pour commencer à utiliser les services CHICANO.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}
