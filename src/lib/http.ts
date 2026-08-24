import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError, UnverifiedAccountError } from "@/lib/vehicles/guard";
import { VehicleNotFoundError, VehicleConflictError } from "@/lib/vehicles/service";

// Catalogue d'erreurs HTTP de l'API (section 13 de la Phase 2) :
//   400 Données invalides         — payload rejeté par un schéma zod
//   401 Non authentifié           — pas de session valide
//   403 Accès interdit            — authentifié mais compte non vérifié
//   404 Véhicule introuvable      — inexistant OU appartenant à un autre client
//                                    (délibérément fusionnés : ne jamais confirmer
//                                    l'existence d'un véhicule qui n'appartient pas
//                                    à l'appelant — voir docs/VEHICLES.md)
//   409 Conflit métier            — véhicule possédé mais dans un état incompatible
//                                    avec l'opération (ex. déjà archivé)
//   500 Erreur serveur            — jamais la stack Prisma brute exposée au client

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromZodError(error: ZodError) {
  const flattened = error.flatten((issue) => issue.message);
  const firstIssue = error.issues[0];
  return NextResponse.json(
    {
      error: firstIssue?.message ?? "Données invalides.",
      fieldErrors: flattened.fieldErrors,
    },
    { status: 400 }
  );
}

// Traduit les erreurs métier connues des routes API véhicules en réponses
// HTTP cohérentes. Retourne null si l'erreur n'est pas reconnue (l'appelant
// doit alors logger et répondre 500) — jamais la stack Prisma brute exposée
// au client.
export function jsonFromKnownError(err: unknown) {
  if (err instanceof ZodError) return jsonFromZodError(err);
  if (err instanceof UnauthenticatedError) return jsonError(err.message, 401);
  if (err instanceof UnverifiedAccountError) return jsonError(err.message, 403);
  if (err instanceof VehicleNotFoundError) return jsonError(err.message, 404);
  if (err instanceof VehicleConflictError) return jsonError(err.message, 409);
  return null;
}

export function jsonApiErrorResponse(err: unknown) {
  const known = jsonFromKnownError(err);
  if (known) return known;
  console.error(err);
  return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
}
