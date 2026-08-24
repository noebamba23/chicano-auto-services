import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import { verifyOtpSchema } from "@/lib/validation/auth";
import { WhatsAppVerificationService, WhatsAppVerificationError } from "@/lib/messaging/whatsapp-verification-service";
import { jsonError, jsonFromZodError } from "@/lib/http";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Non authentifié.", 401);

  try {
    const body = verifyOtpSchema.parse(await req.json());
    await WhatsAppVerificationService.verifyCode(session.sub, body.code);
    return NextResponse.json({ redirectTo: "/espace-client" });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    if (err instanceof WhatsAppVerificationError) return jsonError(err.message, 422);
    console.error(err);
    return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
  }
}
