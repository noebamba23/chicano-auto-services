import { db } from "@/lib/db";
import { generateOtpCode, hashOtpCode, verifyOtpCode, otpConfig } from "@/lib/auth/otp";
import { getWhatsAppProvider, isMockWhatsAppActive } from "./get-provider";

// Service central de vérification WhatsApp (section 8 du prompt maître).
// Règles de sécurité OTP appliquées (section 10) :
//  - usage unique (consumedAt)
//  - durée de validité limitée (expiresAt, configurable)
//  - stockage sécurisé (code_hash, jamais en clair)
//  - tentatives limitées (maxAttempts, configurable)
//  - délai avant renvoi (resendCooldownSeconds, configurable)

export class WhatsAppVerificationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "COOLDOWN"
      | "NOT_FOUND"
      | "EXPIRED"
      | "ALREADY_CONSUMED"
      | "MAX_ATTEMPTS"
      | "INVALID_CODE"
  ) {
    super(message);
    this.name = "WhatsAppVerificationError";
  }
}

function buildOtpMessage(code: string) {
  return `CHICANO AUTO SERVICES\nVotre code de vérification :\n${code}\n\nValable ${otpConfig.ttlMinutes} minutes. Ne le partagez avec personne.`;
}

async function assertCooldownElapsed(userId: string) {
  const last = await db.whatsappVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!last) return;

  const elapsedSeconds = (Date.now() - last.lastSentAt.getTime()) / 1000;
  if (elapsedSeconds < otpConfig.resendCooldownSeconds) {
    const waitSeconds = Math.ceil(otpConfig.resendCooldownSeconds - elapsedSeconds);
    throw new WhatsAppVerificationError(
      `Veuillez patienter ${waitSeconds}s avant de redemander un code.`,
      "COOLDOWN"
    );
  }
}

async function issueAndSendCode(userId: string, phoneE164: string, resendCountIncrement: number) {
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + otpConfig.ttlMinutes * 60_000);

  const verification = await db.whatsappVerification.create({
    data: {
      userId,
      phoneNumber: phoneE164,
      codeHash,
      expiresAt,
      maxAttempts: otpConfig.maxAttempts,
      lastSentAt: new Date(),
      resendCount: resendCountIncrement,
    },
  });

  const provider = getWhatsAppProvider();
  const result = await provider.sendText(phoneE164, buildOtpMessage(code));

  if (!result.success) {
    throw new WhatsAppVerificationError(
      `Échec de l'envoi du code WhatsApp : ${result.error ?? "erreur inconnue"}`,
      "NOT_FOUND"
    );
  }

  // MODE MOCK : le code n'est jamais renvoyé au client via l'interface en
  // production (section 8). En développement il est journalisé serveur
  // uniquement, jamais dans la réponse HTTP.
  if (isMockWhatsAppActive() && process.env.NODE_ENV !== "production") {
    console.log(`[OTP DEV] userId=${userId} phone=${phoneE164} code=${code}`);
  }

  return verification;
}

export const WhatsAppVerificationService = {
  async sendVerificationCode(userId: string, phoneE164: string) {
    await assertCooldownElapsed(userId);
    return issueAndSendCode(userId, phoneE164, 0);
  },

  async resendCode(userId: string, phoneE164: string) {
    await assertCooldownElapsed(userId);
    const previousCount = await db.whatsappVerification.count({ where: { userId } });
    return issueAndSendCode(userId, phoneE164, previousCount);
  },

  async verifyCode(userId: string, submittedCode: string) {
    const verification = await db.whatsappVerification.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      throw new WhatsAppVerificationError("Aucun code en attente. Demandez un nouveau code.", "NOT_FOUND");
    }

    if (verification.expiresAt < new Date()) {
      throw new WhatsAppVerificationError("Ce code a expiré. Demandez un nouveau code.", "EXPIRED");
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new WhatsAppVerificationError(
        "Nombre maximal de tentatives atteint. Demandez un nouveau code.",
        "MAX_ATTEMPTS"
      );
    }

    const isValid = await verifyOtpCode(submittedCode, verification.codeHash);

    if (!isValid) {
      await db.whatsappVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = verification.maxAttempts - (verification.attempts + 1);
      throw new WhatsAppVerificationError(
        remaining > 0
          ? `Code incorrect. ${remaining} tentative(s) restante(s).`
          : "Code incorrect. Nombre maximal de tentatives atteint.",
        "INVALID_CODE"
      );
    }

    const now = new Date();

    await db.$transaction([
      db.whatsappVerification.update({
        where: { id: verification.id },
        data: { consumedAt: now, verifiedAt: now },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          whatsappVerified: true,
          whatsappVerifiedAt: now,
          status: "VERIFIED",
        },
      }),
      db.auditLog.create({
        data: {
          userId,
          action: "WHATSAPP_VERIFIED",
          entity: "User",
          entityId: userId,
          newValue: { whatsappVerified: true },
        },
      }),
    ]);

    return { verifiedAt: now };
  },
};
