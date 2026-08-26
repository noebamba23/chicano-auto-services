import { getSession } from "@/lib/auth/session";
import { UnauthenticatedError } from "@/lib/vehicles/guard";
import { getTechnicianIdForUser } from "./service";

// Garde des routes/pages réservées aux techniciens (Phase 5) — même principe
// que requireVerifiedCustomer (client) et requireProductionRole (équipe
// CHICANO) : authentification + rôle + résolution de l'identité métier
// (technicianId) faite une fois ici plutôt que répétée dans chaque route.

export class ForbiddenTechnicianRoleError extends Error {
  constructor() {
    super("Accès réservé aux techniciens CHICANO.");
    this.name = "ForbiddenTechnicianRoleError";
  }
}

export async function requireTechnician() {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") throw new UnauthenticatedError();
  if (session.role !== "TECHNICIAN") throw new ForbiddenTechnicianRoleError();

  const technicianId = await getTechnicianIdForUser(session.sub);
  if (!technicianId) throw new ForbiddenTechnicianRoleError();

  return { session, technicianId };
}
