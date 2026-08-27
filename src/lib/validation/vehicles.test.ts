import { describe, expect, it } from "vitest";
import { vehicleInputSchema } from "./vehicles";

const VALID_INPUT = {
  make: "Toyota",
  model: "Hilux",
  fuelType: "DIESEL" as const,
  plateInput: "AB123CD",
};

describe("vehicleInputSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = vehicleInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("rejects a missing marque", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, make: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing modèle", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, model: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty immatriculation", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a missing VIN (facultatif)", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, vin: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a year too far in the future", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, year: 3000 });
    expect(result.success).toBe(false);
  });

  it("rejects a year too far in the past", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, year: 1900 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative mileage", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, mileage: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts a zero mileage", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, mileage: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid fuelType enum value", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, fuelType: "NOT_A_FUEL" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid bodyType enum value", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, bodyType: "SPACESHIP" });
    expect(result.success).toBe(false);
  });
});

// Immatriculation — MVP volontairement simplifié à la seule règle de format
// LL CCC LL (2 lettres, 3 chiffres, 2 lettres), aucune donnée territoriale.
// Validé au niveau du schéma via validatePlateNumber() — voir
// src/lib/vehicles/registration/plate.test.ts pour les tests unitaires du
// module de parsing lui-même.
describe("vehicleInputSchema — format de l'immatriculation", () => {
  it("1. AB123CD → valide", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "AB123CD" }).success).toBe(true);
  });

  it("2. AB 123 CD → valide", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "AB 123 CD" }).success).toBe(true);
  });

  it("3. ab123cd → valide (normalisé en majuscules)", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "ab123cd" }).success).toBe(true);
  });

  it("4. AB-123-CD → valide (tirets traités comme séparateurs parasites)", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "AB-123-CD" }).success).toBe(true);
  });

  it("5. AB1234CD → invalide (4 chiffres)", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "AB1234CD" }).success).toBe(false);
  });

  it("6. A123CD → invalide (1 lettre au lieu de 2)", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "A123CD" }).success).toBe(false);
  });

  it("7. AB12CD → invalide (2 chiffres au lieu de 3)", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "AB12CD" }).success).toBe(false);
  });

  it("8. lettres/chiffres inversés → invalide", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "12ABCD3" }).success).toBe(false);
    expect(vehicleInputSchema.safeParse({ ...VALID_INPUT, plateInput: "1234567" }).success).toBe(false);
  });

});
