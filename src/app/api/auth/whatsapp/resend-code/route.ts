import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { WhatsAppVerificationService, WhatsAppVerificationError } from "@/lib/messaging/whatsapp-verification-service";
import { jsonError } from "@/lib/http";

export async function POST() {
  const session = await getSession();
  if (!session) return jsonError("Non authentifié.", 401);

  try {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    if (!user) return jsonError("Utilisateur introuvable.", 404);
    if (user.whatsappVerified) return jsonError("Ce compte est déjà vérifié.", 409);

    await WhatsAppVerificationService.resendCode(user.id, user.phoneE164);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WhatsAppVerificationError) return jsonError(err.message, 422);
    console.error(err);
    return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
  }
}
