import { getSession } from "@/lib/auth/session";
import { UnauthenticatedError } from "@/lib/vehicles/guard";
import type { UserRole } from "@prisma/client";

// Garde des routes/pages réservées à l'équipe CHICANO (production, admin) —
// distincte de requireVerifiedCustomer (client). Un client authentifié et
// vérifié ne doit jamais pouvoir déclencher une action réservée à la
// production (accepter/refuser/replanifier une demande) — voir
// docs/SERVICE-REQUESTS.md, section "Accès production".

const PRODUCTION_ROLES: readonly UserRole[] = ["PRODUCTION_STAFF", "ADMIN", "SUPER_ADMIN"];
// Pas de rôle Manager distinct dans ce projet (voir docs/BILLING.md,
// section "Non couvert") — ADMIN/SUPER_ADMIN couvrent le "CRM complet"
// demandé en Phase 10 (campagnes, catalogue CHICANO CARE), PRODUCTION_STAFF
// le "CRM opérationnel" (lecture, relances, interactions, abonnements).
const ADMIN_ROLES: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export class ForbiddenRoleError extends Error {
  constructor() {
    super("Accès réservé à l'équipe CHICANO.");
    this.name = "ForbiddenRoleError";
  }
}

export async function requireProductionRole() {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") throw new UnauthenticatedError();
  if (!PRODUCTION_ROLES.includes(session.role)) throw new ForbiddenRoleError();
  return { session };
}

export async function requireAdminRole() {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") throw new UnauthenticatedError();
  if (!ADMIN_ROLES.includes(session.role)) throw new ForbiddenRoleError();
  return { session };
}
