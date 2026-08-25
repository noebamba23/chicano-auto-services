import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

const PRODUCTION_ROLES = ["PRODUCTION_STAFF", "ADMIN", "SUPER_ADMIN"];

// Zone équipe CHICANO — dark mode possible (section "DESIGN" de la Phase 3),
// distincte de l'espace client (light mode prioritaire).
export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/production/demandes");
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") redirect("/connexion");
  if (!PRODUCTION_ROLES.includes(session.role)) redirect("/espace-client");

  return (
    <div className="min-h-screen bg-chicano-black text-chicano-white">
      <header className="border-b border-white/10 bg-chicano-black">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/production/demandes" className="text-sm font-bold">
            CHICANO <span className="text-chicano-red">CONTROL CENTER</span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
