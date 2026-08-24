import { z } from "zod";
import { FuelType, TransmissionType, VehicleBodyType } from "@prisma/client";

const CURRENT_YEAR = new Date().getFullYear();

// Validation robuste mais volontairement permissive sur les formats maliens
// (section 8 de la Phase 2) : on ne bloque pas un véhicule légitime parce que
// son immatriculation ne suit pas un motif précis, ou que son VIN n'a pas
// exactement 17 caractères (véhicules anciens, importés, etc.).

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
  licensePlate: z.string().trim().min(1, "L'immatriculation est obligatoire.").max(20),
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
