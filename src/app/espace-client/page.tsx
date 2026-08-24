import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const ACTIONS = [
  { emoji: "🔧", label: "Demander un service", href: "#", available: false },
  { emoji: "🚨", label: "Urgence", href: "/urgence", available: true },
  { emoji: "📅", label: "Mes rendez-vous", href: "#", available: false },
  { emoji: "🚗", label: "Mes véhicules", href: "#", available: false },
  { emoji: "📄", label: "Mes rapports", href: "#", available: false },
  { emoji: "💰", label: "Mes devis", href: "#", available: false },
];

export default async function ClientDashboardPage() {
  const session = await getSession();
  const user = session
    ? await db.user.findUnique({ where: { id: session.sub }, select: { firstName: true } })
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Bonjour {user?.firstName ?? ""}</h1>

      <section className="mt-8 rounded-lg border border-dashed border-chicano-gray-light bg-white p-6">
        <p className="text-sm font-semibold text-chicano-black">Mon véhicule principal</p>
        <p className="mt-2 text-sm text-chicano-gray">
          Vous n&apos;avez pas encore ajouté de véhicule. L&apos;ajout de véhicule sera disponible très
          prochainement.
        </p>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ACTIONS.map((action) =>
          action.available ? (
            <a
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-lg border border-chicano-gray-light bg-white p-5 text-center transition hover:border-chicano-red"
            >
              <span className="text-2xl">{action.emoji}</span>
              <span className="text-sm font-medium text-chicano-black">{action.label}</span>
            </a>
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
