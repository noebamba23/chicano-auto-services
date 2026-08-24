import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser, getVehicleForCustomer, VehicleNotFoundError } from "@/lib/vehicles/service";

const TYPE_LABELS: Record<string, string> = {
  diagnostic: "Diagnostic",
  entretien: "Entretien",
};

// Route réelle (pas un lien décoratif) préparée pour le workflow de demande de
// service de la Phase 3 — le Vehicle ID est déjà transmis et son ownership
// vérifiée ; seul le formulaire de demande proprement dit reste à construire.
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

  let vehicle = null;
  if (vehicleId) {
    try {
      vehicle = await getVehicleForCustomer(customerId, vehicleId);
    } catch (err) {
      if (err instanceof VehicleNotFoundError) notFound();
      throw err;
    }
  }

  const typeLabel = type ? (TYPE_LABELS[type] ?? type) : null;

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="text-3xl">🔧</p>
      <h1 className="mt-4 text-xl font-bold text-chicano-black">
        Demande de service{typeLabel ? ` — ${typeLabel}` : ""}
      </h1>
      {vehicle ? (
        <p className="mt-2 text-sm text-chicano-gray">
          Pour <strong className="text-chicano-black">{vehicle.make} {vehicle.model}</strong> (
          {vehicle.chicanoVehicleId})
        </p>
      ) : (
        <p className="mt-2 text-sm text-chicano-gray">Sélectionnez d&apos;abord un véhicule.</p>
      )}
      <p className="mt-4 text-sm text-chicano-gray">
        Le parcours complet de demande de service (planning, localisation, validation CHICANO) arrive en
        Phase 3. Votre véhicule est déjà identifié et prêt pour cette étape.
      </p>
      <Link
        href={vehicle ? `/espace-client/vehicules/${vehicle.id}` : "/espace-client/vehicules"}
        className="mt-6 inline-block rounded-md border border-chicano-gray-light px-5 py-2.5 text-sm font-semibold text-chicano-black hover:border-chicano-red"
      >
        Retour {vehicle ? "à la fiche véhicule" : "à mes véhicules"}
      </Link>
    </div>
  );
}
