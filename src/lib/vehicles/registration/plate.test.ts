import { describe, expect, it } from "vitest";
import {
  normalizePlateNumber,
  validatePlateNumber,
  parsePlateNumber,
  formatPlateNumber,
  buildPlateNumber,
  InvalidPlateFormatError,
} from "./plate";

describe("normalizePlateNumber", () => {
  it("met en majuscules", () => {
    expect(normalizePlateNumber("ab123cd")).toBe("AB123CD");
  });

  it("retire les espaces", () => {
    expect(normalizePlateNumber("AB 123 CD")).toBe("AB123CD");
  });

  it("retire les tirets et points", () => {
    expect(normalizePlateNumber("AB-123.CD")).toBe("AB123CD");
  });

  it("retire les espaces en début/fin", () => {
    expect(normalizePlateNumber("  AB123CD  ")).toBe("AB123CD");
  });

  it(' ab-123-cd  → "AB123CD" (cas de la demande de simplification MVP)', () => {
    expect(normalizePlateNumber(" ab-123-cd ")).toBe("AB123CD");
  });
});

describe("validatePlateNumber", () => {
  it("AB123CD → PASS", () => expect(validatePlateNumber("AB123CD")).toBe(true));
  it("AB 123 CD → PASS après normalisation", () => expect(validatePlateNumber("AB 123 CD")).toBe(true));
  it("ab123cd → PASS après normalisation", () => expect(validatePlateNumber("ab123cd")).toBe(true));
  it("AB1234CD → FAIL", () => expect(validatePlateNumber("AB1234CD")).toBe(false));
  it("A123CD → FAIL", () => expect(validatePlateNumber("A123CD")).toBe(false));
  it("AB12CD → FAIL", () => expect(validatePlateNumber("AB12CD")).toBe(false));
  it("1234567 → FAIL", () => expect(validatePlateNumber("1234567")).toBe(false));
  it("ABC123D → FAIL", () => expect(validatePlateNumber("ABC123D")).toBe(false));
  it("chaîne vide → FAIL", () => expect(validatePlateNumber("")).toBe(false));
});

describe("parsePlateNumber", () => {
  it("décompose en série/numéro d'ordre/suffixe", () => {
    expect(parsePlateNumber("AB123CD")).toEqual({ series: "AB", sequence: 123, suffix: "CD" });
  });

  it("décompose après normalisation (espaces, minuscules)", () => {
    expect(parsePlateNumber("ab 007 cd")).toEqual({ series: "AB", sequence: 7, suffix: "CD" });
  });

  it("retourne null pour un format invalide plutôt que de lever", () => {
    expect(parsePlateNumber("AB1234CD")).toBeNull();
  });
});

describe("buildPlateNumber — reconstruction depuis les composants structurés", () => {
  it("reconstruit la plaque normalisée, numéro d'ordre remis sur 3 chiffres", () => {
    expect(buildPlateNumber({ series: "AB", sequence: 7, suffix: "CD" })).toBe("AB007CD");
  });

  it("round-trip avec parsePlateNumber", () => {
    const parsed = parsePlateNumber("EF456GH")!;
    expect(buildPlateNumber(parsed)).toBe("EF456GH");
  });
});

describe("formatPlateNumber — affichage", () => {
  it('"AB123CD" → "AB 123 CD"', () => {
    expect(formatPlateNumber("AB123CD")).toBe("AB 123 CD");
  });

  it("retourne la valeur brute pour une immatriculation héritée non conforme (ne lève jamais)", () => {
    expect(formatPlateNumber("AB 1234 MD")).toBe("AB 1234 MD");
  });

  it("retourne null pour une valeur absente", () => {
    expect(formatPlateNumber(null)).toBeNull();
    expect(formatPlateNumber(undefined)).toBeNull();
  });
});

describe("InvalidPlateFormatError — garde défensive interne de buildPlateNumber", () => {
  it("ne peut être atteinte qu'avec des composants qui ne reconstruisent pas un format valide", () => {
    expect(() => buildPlateNumber({ series: "A", sequence: 1, suffix: "CD" })).toThrow(InvalidPlateFormatError);
  });
});

describe("recherche normalisée (AB123CD / AB 123 CD / ab123cd doivent être équivalents)", () => {
  it("les trois formes se normalisent vers la même valeur", () => {
    expect(normalizePlateNumber("AB123CD")).toBe(normalizePlateNumber("AB 123 CD"));
    expect(normalizePlateNumber("AB 123 CD")).toBe(normalizePlateNumber("ab123cd"));
  });
});
