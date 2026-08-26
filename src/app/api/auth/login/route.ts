import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { normalizePhoneNumber, InvalidPhoneNumberError } from "@/lib/phone";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/home-for-role";
import { jsonError, jsonFromZodError } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const phone = normalizePhoneNumber(body.phone);

    const user = await db.user.findUnique({ where: { phoneE164: phone.e164 } });
    if (!user) {
      return jsonError("Numéro ou mot de passe incorrect.", 401);
    }

    const validPassword = await verifyPassword(body.password, user.passwordHash);
    if (!validPassword) {
      return jsonError("Numéro ou mot de passe incorrect.", 401);
    }

    if (user.status === "SUSPENDED" || user.status === "BLOCKED") {
      return jsonError("Ce compte est actuellement suspendu. Contactez le support CHICANO.", 403);
    }

    await createSession(user, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    const redirectTo = user.status === "PENDING_VERIFICATION" ? "/verification-whatsapp" : homeForRole(user.role);
    return NextResponse.json({ redirectTo });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    if (err instanceof InvalidPhoneNumberError) return jsonError(err.message, 422);
    console.error(err);
    return jsonError("Une erreur est survenue. Veuillez réessayer.", 500);
  }
}
