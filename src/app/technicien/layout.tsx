import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/home-for-role";
import { LogoutButton } from "@/components/auth/logout-button";

// Zone technicien (Phase 5) — même discipline dark mode que l'espace
// production (section "DESIGN" de la Phase 3), garde redondante avec
// src/proxy.ts pour une redirection immédiate côté page plutôt qu'un flash
// de contenu avant redirection.
export default async function TechnicienLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/technicien");
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") redirect("/connexion");
  if (session.role !== "TECHNICIAN") redirect(homeForRole(session.role));

  return (
    <div className="min-h-screen bg-chicano-black text-chicano-white">
      <header className="border-b border-white/10 bg-chicano-black">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/technicien" className="text-sm font-bold">
            CHICANO <span className="text-chicano-red">TECHNICIEN</span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
