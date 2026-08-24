import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation/auth";
import { normalizePhoneNumber, InvalidPhoneNumberError } from "@/lib/phone";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { WhatsAppVerificationService } from "@/lib/messaging/whatsapp-verification-service";
import { jsonError, jsonFromZodError } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json());
    const phone = normalizePhoneNumber(body.phone);

    const existing = await db.user.findUnique({ where: { phoneE164: phone.e164 } });
    if (existing) {
      return jsonError("Un compte existe déjà avec ce numéro WhatsApp.", 409);
    }

    const passwordHash = await hashPassword(body.password);

    const user = await db.user.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email || undefined,
        phoneRaw: body.phone,
        phoneE164: phone.e164,
        passwordHash,
        termsAcceptedAt: new Date(),
        status: "PENDING_VERIFICATION",
        customerProfile: { create: {} },
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, action: "USER_REGISTERED", entity: "User", entityId: user.id },
    });

    await createSession(user, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    try {
      await WhatsAppVerificationService.sendVerificationCode(user.id, user.phoneE164);
    } catch (err) {
      // Le compte est créé même si l'envoi échoue immédiatement — l'utilisateur
      // pourra redemander un code depuis l'écran de vérification.
      console.error("Échec envoi OTP à l'inscription:", err);
    }

    return NextResponse.json({ redirectTo: "/verification-whatsapp" }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    if (err instanceof InvalidPhoneNumberError) return jsonError(err.message, 422);
    console.error(err);
    return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
  }
}
