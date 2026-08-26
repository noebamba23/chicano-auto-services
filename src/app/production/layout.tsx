import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/home-for-role";
import { LogoutButton } from "@/components/auth/logout-button";

const PRODUCTION_ROLES = ["PRODUCTION_STAFF", "ADMIN", "SUPER_ADMIN"];

const NAV_LINKS = [
  { href: "/production/demandes", label: "Demandes" },
  { href: "/production/kanban", label: "Kanban" },
  { href: "/production/calendrier", label: "Calendrier" },
  { href: "/production/techniciens", label: "Techniciens" },
];

// Zone équipe CHICANO — dark mode possible (section "DESIGN" de la Phase 3),
// distincte de l'espace client (light mode prioritaire).
export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/production/demandes");
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") redirect("/connexion");
  if (!PRODUCTION_ROLES.includes(session.role)) redirect(homeForRole(session.role));

  return (
    <div className="min-h-screen bg-chicano-black text-chicano-white">
      <header className="border-b border-white/10 bg-chicano-black">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/production/demandes" className="text-sm font-bold">
            CHICANO <span className="text-chicano-red">CONTROL CENTER</span>
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-white/70 hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
        <nav className="flex items-center gap-4 overflow-x-auto border-t border-white/5 px-4 py-2 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-sm text-white/70">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
