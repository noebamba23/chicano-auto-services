import { describe, expect, it } from "vitest";
import { createServiceRequestSchema } from "./service-requests";

const BASE = {
  vehicleId: "veh-1",
  category: "DIAGNOSTIC" as const,
  description: "Le moteur chauffe.",
  interventionType: "AT_GARAGE" as const,
  isUrgent: false,
};

describe("createServiceRequestSchema", () => {
  it("accepte une demande minimale au garage", () => {
    expect(createServiceRequestSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejette une description vide", () => {
    expect(createServiceRequestSchema.safeParse({ ...BASE, description: "" }).success).toBe(false);
  });

  it("rejette une intervention mobile sans localisation", () => {
    const result = createServiceRequestSchema.safeParse({ ...BASE, interventionType: "MOBILE" });
    expect(result.success).toBe(false);
  });

  it("accepte une intervention mobile avec des coordonnées GPS", () => {
    const result = createServiceRequestSchema.safeParse({
      ...BASE,
      interventionType: "MOBILE",
      location: { latitude: 12.65, longitude: -8.0, locationSource: "GPS" },
    });
    expect(result.success).toBe(true);
  });

  it("accepte une intervention mobile avec une adresse libre seule (sans GPS)", () => {
    const result = createServiceRequestSchema.safeParse({
      ...BASE,
      interventionType: "MOBILE",
      location: { landmark: "Près du marché de Banankoro", locationSource: "MANUAL" },
    });
    expect(result.success).toBe(true);
  });

  it("rejette une intervention mobile avec un objet location vide", () => {
    const result = createServiceRequestSchema.safeParse({
      ...BASE,
      interventionType: "MOBILE",
      location: { locationSource: "MANUAL" },
    });
    expect(result.success).toBe(false);
  });

  it("rejette une demande urgente sans description de la situation", () => {
    const result = createServiceRequestSchema.safeParse({ ...BASE, isUrgent: true });
    expect(result.success).toBe(false);
  });

  it("accepte une demande urgente avec description", () => {
    const result = createServiceRequestSchema.safeParse({
      ...BASE,
      isUrgent: true,
      urgencyDescription: "Véhicule immobilisé sur la route.",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une catégorie de service invalide", () => {
    const result = createServiceRequestSchema.safeParse({ ...BASE, category: "NOT_A_CATEGORY" });
    expect(result.success).toBe(false);
  });
});
