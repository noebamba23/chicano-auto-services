import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { AccountStatus, UserRole } from "@prisma/client";

// Authentification de session — distincte de la vérification WhatsApp (OTP).
// cf. section 13 du prompt maître : "Ne mélange pas vérification du numéro
// et authentification de session."

const COOKIE_NAME = "chicano_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET manquant ou trop court dans l'environnement.");
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionPayload {
  sub: string;
  role: UserRole;
  status: AccountStatus;
}

export async function createSession(
  user: { id: string; role: UserRole; status: AccountStatus },
  meta?: { userAgent?: string; ipAddress?: string }
) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const token = await new SignJWT({ role: user.role, status: user.status } satisfies Omit<
    SessionPayload,
    "sub"
  >)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(jti),
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const jti = payload.jti;
    if (!jti || !payload.sub) return null;

    const session = await db.session.findUnique({ where: { tokenHash: hashToken(jti) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      status: payload.status as AccountStatus,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);

  if (!token) return;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.jti) {
      await db.session.updateMany({
        where: { tokenHash: hashToken(payload.jti) },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // token déjà invalide, rien à révoquer
  }
}
