import { z } from "zod";
import { FuelType, TransmissionType, VehicleBodyType } from "@prisma/client";
import { validatePlateNumber } from "@/lib/vehicles/registration/plate";

const CURRENT_YEAR = new Date().getFullYear();

// Validation robuste mais volontairement permissive sur les caractéristiques
// libres (section 8 de la Phase 2) : on ne bloque pas un véhicule légitime
// parce que son VIN n'a pas exactement 17 caractères (véhicules anciens,
// importés, etc.). L'immatriculation, elle, est strictement validée contre
// le format LL CCC LL (MVP volontairement simplifié à ce seul format, aucune
// donnée territoriale) — voir src/lib/vehicles/registration/plate.ts.

const yearField = z
  .coerce.number()
  .int()
  .min(1950, "Année invalide.")
  .max(CURRENT_YEAR + 1, "Année invalide.")
  .optional()
  .nullable();

const mileageField = z
  .coerce.number()
  .int()
  .min(0, "Le kilométrage ne peut pas être négatif.")
  .optional()
  .nullable();

export const vehicleInputSchema = z.object({
  make: z.string().trim().min(1, "La marque est obligatoire.").max(60),
  model: z.string().trim().min(1, "Le modèle est obligatoire.").max(60),
  trim: z.string().trim().max(60).optional().or(z.literal("")),
  year: yearField,
  bodyType: z.nativeEnum(VehicleBodyType).optional().nullable(),
  fuelType: z.nativeEnum(FuelType),
  engine: z.string().trim().max(60).optional().or(z.literal("")),
  transmission: z.nativeEnum(TransmissionType).optional().nullable(),
  // Saisie brute utilisateur — "AB123CD", "AB 123 CD" ou "ab123cd" sont tous
  // acceptés ici (ne pas exiger que l'utilisateur connaisse la structure
  // technique) ; la normalisation se fait dans src/lib/vehicles/service.ts
  // via normalizePlateNumber(), jamais dupliquée ici.
  plateInput: z
    .string()
    .trim()
    .min(1, "Le numéro d'immatriculation est obligatoire.")
    .refine(validatePlateNumber, "Le numéro d'immatriculation doit respecter le format malien LL CCC LL."),
  vin: z.string().trim().max(32).optional().or(z.literal("")),
  mileage: mileageField,
  color: z.string().trim().max(40).optional().or(z.literal("")),
  firstRegisteredAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Date invalide."),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const vehicleUpdateSchema = vehicleInputSchema.partial();
