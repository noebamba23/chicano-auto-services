import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "./service";

// Garde commune aux routes véhicules : authentification + compte vérifié
// (section 6/12 du prompt maître — un compte PENDING_VERIFICATION ne peut pas
// utiliser les fonctionnalités transactionnelles) + résolution du customerId
// réel côté serveur. Les routes API ne sont pas couvertes par le matcher de
// src/proxy.ts (qui ne protège que les pages), donc ce contrôle doit être
// fait explicitement ici, pas seulement supposé côté client.

export class UnauthenticatedError extends Error {
  constructor() {
    super("Non authentifié.");
    this.name = "UnauthenticatedError";
  }
}

export class UnverifiedAccountError extends Error {
  constructor() {
    super("Votre compte doit être vérifié par WhatsApp avant d'utiliser cette fonctionnalité.");
    this.name = "UnverifiedAccountError";
  }
}

export async function requireVerifiedCustomer() {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (session.status === "SUSPENDED" || session.status === "BLOCKED") throw new UnauthenticatedError();
  if (session.status === "PENDING_VERIFICATION") throw new UnverifiedAccountError();

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) throw new UnauthenticatedError();

  return { session, customerId };
}
