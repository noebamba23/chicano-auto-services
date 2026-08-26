import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/home-for-role";

// Garde d'accès aux espaces protégés. Depuis Next.js 16, Proxy tourne par
// défaut sur le runtime Node.js (cf. node_modules/next/dist/docs/.../proxy.md)
// ce qui permet un contrôle autoritaire complet ici (JWT + statut du compte en
// base via getSession()), sans dépendre uniquement d'un check edge léger.

const PROTECTED_PREFIXES = ["/espace-client", "/production", "/admin", "/technicien"];
const AUTH_ONLY_PAGES = ["/connexion", "/inscription"];
const PRODUCTION_PREFIXES = ["/production", "/admin"];
const PRODUCTION_ROLES = ["PRODUCTION_STAFF", "ADMIN", "SUPER_ADMIN"];
const TECHNICIAN_PREFIX = "/technicien";
const CLIENT_PREFIX = "/espace-client";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PAGES.includes(pathname);

  if (!isProtected && !isAuthOnly) {
    return NextResponse.next();
  }

  const session = await getSession();

  if (isProtected) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/connexion";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    if (session.status === "SUSPENDED" || session.status === "BLOCKED") {
      const url = req.nextUrl.clone();
      url.pathname = "/connexion";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (session.status === "PENDING_VERIFICATION" && pathname !== "/verification-whatsapp") {
      const url = req.nextUrl.clone();
      url.pathname = "/verification-whatsapp";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Chaque espace (client / production / technicien) est strictement
    // réservé à son rôle — contrôle autoritaire redondant avec
    // requireProductionRole()/requireTechnician() côté API/pages, ici pour
    // une redirection rapide vers le bon espace plutôt qu'une page d'erreur.
    // Étendu en Phase 5 : avant cette phase, seul /production était filtré
    // par rôle ici, /espace-client était accessible à n'importe quel compte
    // authentifié (un technicien ou un membre production y atterrissait sans
    // être bloqué, juste avec un tableau de bord vide côté client).
    if (
      PRODUCTION_PREFIXES.some((p) => pathname.startsWith(p)) &&
      !PRODUCTION_ROLES.includes(session.role)
    ) {
      const url = req.nextUrl.clone();
      url.pathname = homeForRole(session.role);
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith(TECHNICIAN_PREFIX) && session.role !== "TECHNICIAN") {
      const url = req.nextUrl.clone();
      url.pathname = homeForRole(session.role);
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith(CLIENT_PREFIX) && session.role !== "CUSTOMER") {
      const url = req.nextUrl.clone();
      url.pathname = homeForRole(session.role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isAuthOnly && session) {
    const url = req.nextUrl.clone();
    url.pathname = homeForRole(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/espace-client/:path*",
    "/production/:path*",
    "/admin/:path*",
    "/technicien/:path*",
    "/connexion",
    "/inscription",
  ],
};
