import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, getVehicleForCustomer, VehicleNotFoundError } from "@/lib/vehicles/service";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/vehicules/${id}/modifier`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let vehicle;
  try {
    vehicle = await getVehicleForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof VehicleNotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/espace-client/vehicules/${id}`}
        className="text-sm text-chicano-gray hover:text-chicano-red"
      >
        ← {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-chicano-black">Modifier mon véhicule</h1>

      <div className="mt-8 rounded-lg border border-chicano-gray-light bg-white p-6">
        <VehicleForm vehicle={vehicle} />
      </div>
    </div>
  );
}
