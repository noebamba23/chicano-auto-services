import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromZodError(error: ZodError) {
  const firstIssue = error.issues[0];
  return jsonError(firstIssue?.message ?? "Requête invalide.", 422);
}
