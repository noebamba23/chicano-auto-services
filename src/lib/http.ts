import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthenticatedError, UnverifiedAccountError } from "@/lib/vehicles/guard";
import { VehicleNotFoundError } from "@/lib/vehicles/service";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromZodError(error: ZodError) {
  const firstIssue = error.issues[0];
  return jsonError(firstIssue?.message ?? "Requête invalide.", 422);
}

// Traduit les erreurs métier connues des routes API véhicules en réponses
// HTTP cohérentes. Retourne null si l'erreur n'est pas reconnue (l'appelant
// doit alors logger et répondre 500).
export function jsonFromKnownError(err: unknown) {
  if (err instanceof ZodError) return jsonFromZodError(err);
  if (err instanceof UnauthenticatedError) return jsonError(err.message, 401);
  if (err instanceof UnverifiedAccountError) return jsonError(err.message, 403);
  if (err instanceof VehicleNotFoundError) return jsonError(err.message, 404);
  return null;
}

export function jsonApiErrorResponse(err: unknown) {
  const known = jsonFromKnownError(err);
  if (known) return known;
  console.error(err);
  return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
}
