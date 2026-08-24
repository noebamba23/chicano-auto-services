import Link from "next/link";
import type { Vehicle, VehiclePhoto } from "@prisma/client";
import { fuelTypeLabel, transmissionLabel } from "@/lib/vehicles/options";

type VehicleWithPhotos = Vehicle & { photos: VehiclePhoto[] };

export function VehicleCard({ vehicle }: { vehicle: VehicleWithPhotos }) {
  const cover = vehicle.photos[0]?.url;

  return (
    <div className="overflow-hidden rounded-lg border border-chicano-gray-light bg-white">
      <div className="flex h-32 items-center justify-center bg-chicano-gray-light">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl">🚗</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-chicano-black">
              {vehicle.make} {vehicle.model}
            </p>
            <p className="text-xs text-chicano-gray">{vehicle.chicanoVehicleId}</p>
          </div>
          {vehicle.isPrimary && (
            <span className="shrink-0 rounded-full bg-chicano-red/10 px-2 py-1 text-xs font-semibold text-chicano-red">
              Principal
            </span>
          )}
        </div>

        <p className="mt-2 text-sm text-chicano-gray">
          {[vehicle.year, fuelTypeLabel(vehicle.fuelType), transmissionLabel(vehicle.transmission)]
            .filter(Boolean)
            .join(" • ")}
        </p>
        {vehicle.licensePlate && (
          <p className="mt-1 text-sm font-medium text-chicano-black">{vehicle.licensePlate}</p>
        )}
        {vehicle.mileage !== null && (
          <p className="mt-1 text-sm text-chicano-gray">{vehicle.mileage.toLocaleString("fr-FR")} km</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Link
            href={`/espace-client/vehicules/${vehicle.id}`}
            className="rounded-md bg-chicano-black px-2 py-2 text-center font-medium text-white hover:bg-chicano-black-soft"
          >
            Voir le dossier
          </Link>
          <Link
            href={`/espace-client/vehicules/${vehicle.id}/modifier`}
            className="rounded-md border border-chicano-gray-light px-2 py-2 text-center font-medium text-chicano-black hover:border-chicano-red"
          >
            Modifier
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <Link
            href={`/espace-client/demande-service?vehicleId=${vehicle.id}&type=diagnostic`}
            className="rounded-md border border-chicano-gray-light px-2 py-2 text-center font-medium text-chicano-black hover:border-chicano-red"
          >
            Diagnostic
          </Link>
          <Link
            href={`/espace-client/demande-service?vehicleId=${vehicle.id}&type=entretien`}
            className="rounded-md border border-chicano-gray-light px-2 py-2 text-center font-medium text-chicano-black hover:border-chicano-red"
          >
            Entretien
          </Link>
          <Link
            href={`/urgence?vehicleId=${vehicle.id}`}
            className="rounded-md border border-chicano-gray-light px-2 py-2 text-center font-medium text-chicano-black hover:border-chicano-red"
          >
            Assistance
          </Link>
        </div>
      </div>
    </div>
  );
}
