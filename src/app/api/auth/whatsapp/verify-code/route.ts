import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSession, getSession } from "@/lib/auth/session";
import { verifyOtpSchema } from "@/lib/validation/auth";
import { WhatsAppVerificationService, WhatsAppVerificationError } from "@/lib/messaging/whatsapp-verification-service";
import { jsonError, jsonFromZodError } from "@/lib/http";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Non authentifié.", 401);

  try {
    const body = verifyOtpSchema.parse(await req.json());
    await WhatsAppVerificationService.verifyCode(session.sub, body.code);

    // Le cookie de session porte le statut du compte dans son payload JWT,
    // figé au moment de sa création (voir src/lib/auth/session.ts). Sans
    // réémission ici, il continuerait à indiquer PENDING_VERIFICATION après
    // une vérification pourtant réussie en base, et src/proxy.ts renverrait
    // indéfiniment l'utilisateur vers /verification-whatsapp.
    await createSession(
      { id: session.sub, role: session.role, status: "VERIFIED" },
      { userAgent: req.headers.get("user-agent") ?? undefined, ipAddress: req.headers.get("x-forwarded-for") ?? undefined }
    );

    return NextResponse.json({ redirectTo: "/espace-client" });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    if (err instanceof WhatsAppVerificationError) return jsonError(err.message, 422);
    console.error(err);
    return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
  }
}
