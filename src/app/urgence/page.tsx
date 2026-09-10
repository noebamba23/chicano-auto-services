import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconLifeBuoy } from "@/components/marketing/icons";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, getVehicleForCustomer, VehicleNotFoundError } from "@/lib/vehicles/service";

export default async function UrgencePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const session = await getSession();

  let vehicleLabel: string | null = null;
  if (session && vehicleId) {
    const customerId = await getCustomerIdForUser(session.sub);
    if (customerId) {
      try {
        const vehicle = await getVehicleForCustomer(customerId, vehicleId);
        vehicleLabel = `${vehicle.make} ${vehicle.model} (${vehicle.chicanoVehicleId})`;
      } catch (err) {
        if (!(err instanceof VehicleNotFoundError)) throw err;
      }
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-chicano-gray-light px-4 py-24">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-chicano-red/10">
            <IconLifeBuoy className="h-7 w-7 text-chicano-red" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-chicano-black">Demande d&apos;intervention urgente</h1>
          {vehicleLabel && (
            <p className="mt-2 text-sm font-medium text-chicano-black">Concernant : {vehicleLabel}</p>
          )}
          <p className="mt-2 text-sm text-chicano-gray">
            Le parcours de demande urgente (géolocalisation, description de la panne, qualification
            CHICANO) arrive très prochainement.
            {!session && " Créez votre compte dès maintenant pour être prêt."}
          </p>
          <Link
            href={session ? "/espace-client/vehicules" : "/inscription"}
            className="mt-6 inline-block rounded-md bg-chicano-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark"
          >
            {session ? "Retour à mes véhicules" : "Créer mon compte"}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
