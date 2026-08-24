import { parsePhoneNumberWithError, ParseError } from "libphonenumber-js";

const DEFAULT_COUNTRY = "ML"; // Mali — pays de lancement (section 4 du prompt maître)

export interface NormalizedPhone {
  raw: string;
  e164: string;
  country: string | undefined;
}

export class InvalidPhoneNumberError extends Error {
  constructor(message = "Numéro de téléphone invalide.") {
    super(message);
    this.name = "InvalidPhoneNumberError";
  }
}

/**
 * Normalise un numéro saisi par l'utilisateur au format E.164.
 * Le pays par défaut est le Mali (+223) mais tout numéro international
 * valide (préfixé de son indicatif) est accepté.
 */
export function normalizePhoneNumber(input: string): NormalizedPhone {
  const raw = input.trim();

  try {
    const parsed = parsePhoneNumberWithError(raw, DEFAULT_COUNTRY);
    if (!parsed.isValid()) {
      throw new InvalidPhoneNumberError();
    }
    return {
      raw,
      e164: parsed.number,
      country: parsed.country,
    };
  } catch (err) {
    if (err instanceof ParseError || err instanceof InvalidPhoneNumberError) {
      throw new InvalidPhoneNumberError();
    }
    throw err;
  }
}
