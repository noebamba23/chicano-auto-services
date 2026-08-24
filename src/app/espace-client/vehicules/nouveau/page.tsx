import Link from "next/link";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default function NewVehiclePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/espace-client/vehicules" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes véhicules
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-chicano-black">Ajouter mon véhicule</h1>
      <p className="mt-1 text-sm text-chicano-gray">
        Le VIN n&apos;est pas obligatoire si vous ne le connaissez pas — vous pourrez le compléter plus
        tard.
      </p>

      <div className="mt-8 rounded-lg border border-chicano-gray-light bg-white p-6">
        <VehicleForm />
      </div>
    </div>
  );
}
