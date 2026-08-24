import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/connexion?next=/espace-client");
  }
  if (session.status === "PENDING_VERIFICATION") {
    redirect("/verification-whatsapp");
  }
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") {
    redirect("/connexion");
  }

  return (
    <div className="min-h-screen bg-chicano-gray-light">
      <header className="border-b border-chicano-gray-light bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/espace-client" className="text-sm font-bold text-chicano-black">
            CHICANO <span className="text-chicano-red">AUTO SERVICES</span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
