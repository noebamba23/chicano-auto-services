import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

// Garde d'accès aux espaces protégés. Depuis Next.js 16, Proxy tourne par
// défaut sur le runtime Node.js (cf. node_modules/next/dist/docs/.../proxy.md)
// ce qui permet un contrôle autoritaire complet ici (JWT + statut du compte en
// base via getSession()), sans dépendre uniquement d'un check edge léger.

const PROTECTED_PREFIXES = ["/espace-client", "/production", "/admin"];
const AUTH_ONLY_PAGES = ["/connexion", "/inscription"];
const PRODUCTION_PREFIXES = ["/production", "/admin"];
const PRODUCTION_ROLES = ["PRODUCTION_STAFF", "ADMIN", "SUPER_ADMIN"];

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

    // Un client authentifié et vérifié ne doit jamais atteindre l'espace
    // production (section "PRODUCTION ACCESS" de la Phase 3) — contrôle
    // autoritaire redondant avec requireProductionRole() côté API/pages,
    // ici pour une redirection rapide plutôt qu'une page d'erreur.
    if (
      PRODUCTION_PREFIXES.some((p) => pathname.startsWith(p)) &&
      !PRODUCTION_ROLES.includes(session.role)
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/espace-client";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isAuthOnly && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/espace-client";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/espace-client/:path*", "/production/:path*", "/admin/:path*", "/connexion", "/inscription"],
};
