import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

const OTP_SALT_ROUNDS = 10;

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_SALT_ROUNDS);
}

export function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export const otpConfig = {
  get ttlMinutes() {
    return Number(process.env.OTP_TTL_MINUTES ?? 5);
  },
  get maxAttempts() {
    return Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  },
  get resendCooldownSeconds() {
    return Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);
  },
};
