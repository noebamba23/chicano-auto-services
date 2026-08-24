import { describe, expect, it } from "vitest";
import { vehicleInputSchema } from "./vehicles";

const VALID_INPUT = {
  make: "Toyota",
  model: "Hilux",
  fuelType: "DIESEL" as const,
  licensePlate: "AB 1234 MD",
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
    const result = vehicleInputSchema.safeParse({ ...VALID_INPUT, licensePlate: "" });
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
