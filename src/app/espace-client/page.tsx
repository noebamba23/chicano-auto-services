import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getCustomerIdForUser, listVehiclesForCustomer } from "@/lib/vehicles/service";
import { VehicleCard } from "@/components/vehicles/vehicle-card";

const ACTIONS = [
  { emoji: "🔧", label: "Demander un service", href: "#", available: false },
  { emoji: "🚨", label: "Urgence", href: "/urgence", available: true },
  { emoji: "📅", label: "Mes rendez-vous", href: "#", available: false },
  { emoji: "🚗", label: "Mes véhicules", href: "/espace-client/vehicules", available: true },
  { emoji: "📄", label: "Mes rapports", href: "#", available: false },
  { emoji: "💰", label: "Mes devis", href: "#", available: false },
];

export default async function ClientDashboardPage() {
  const session = await getSession();
  const user = session
    ? await db.user.findUnique({ where: { id: session.sub }, select: { firstName: true } })
    : null;

  const customerId = session ? await getCustomerIdForUser(session.sub) : null;
  const vehicles = customerId ? await listVehiclesForCustomer(customerId) : [];
  const primary = vehicles.find((v) => v.isPrimary);

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Bonjour {user?.firstName ?? ""}</h1>

      <section className="mt-8 rounded-lg border border-chicano-gray-light bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-chicano-black">
            Mon véhicule principal
            {vehicles.length > 0 && (
              <span className="ml-2 font-normal text-chicano-gray">
                ({vehicles.length} véhicule{vehicles.length > 1 ? "s" : ""} enregistré
                {vehicles.length > 1 ? "s" : ""})
              </span>
            )}
          </p>
          <Link href="/espace-client/vehicules" className="text-sm font-medium text-chicano-red">
            Voir tout
          </Link>
        </div>

        {primary ? (
          <div className="mt-4 max-w-sm">
            <VehicleCard vehicle={primary} />
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-chicano-gray">Vous n&apos;avez pas encore ajouté de véhicule.</p>
            <Link
              href="/espace-client/vehicules/nouveau"
              className="mt-3 inline-block rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark"
            >
              + Ajouter un véhicule
            </Link>
          </div>
        )}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) =>
          action.available ? (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-lg border border-chicano-gray-light bg-white p-5 text-center transition hover:border-chicano-red"
            >
              <span className="text-2xl">{action.emoji}</span>
              <span className="text-sm font-medium text-chicano-black">{action.label}</span>
            </Link>
          ) : (
            <div
              key={action.label}
              title="Bientôt disponible"
              className="flex flex-col items-center gap-2 rounded-lg border border-chicano-gray-light bg-white p-5 text-center opacity-50"
            >
              <span className="text-2xl">{action.emoji}</span>
              <span className="text-sm font-medium text-chicano-black">{action.label}</span>
            </div>
          )
        )}
      </section>
    </div>
  );
}
