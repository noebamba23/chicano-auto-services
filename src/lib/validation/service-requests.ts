import { z } from "zod";
import { InterventionType, LocationSource, ServiceCategory, UrgencyReason } from "@prisma/client";
import { SERVICE_SLOTS } from "@/lib/service-requests/options";

const SLOT_VALUES = SERVICE_SLOTS.map((s) => s.value) as [string, ...string[]];

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  accuracy: z.coerce.number().optional().nullable(),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  district: z.string().trim().max(120).optional().or(z.literal("")),
  commune: z.string().trim().max(120).optional().or(z.literal("")),
  neighborhood: z.string().trim().max(120).optional().or(z.literal("")),
  landmark: z.string().trim().max(300).optional().or(z.literal("")),
  locationSource: z.nativeEnum(LocationSource),
});

// Section "IMPORTANT — MALI" de la Phase 3 : une adresse peut être imprécise.
// GPS + description libre doivent pouvoir se combiner — on exige donc soit
// des coordonnées, soit au moins un des champs de description libre, jamais
// un format d'adresse strict.
function hasUsableLocation(loc: z.infer<typeof locationSchema>) {
  const hasCoords = loc.latitude != null && loc.longitude != null;
  const hasFreeText = [loc.address, loc.city, loc.district, loc.commune, loc.neighborhood, loc.landmark].some(
    (v) => v && v.trim().length > 0
  );
  return hasCoords || hasFreeText;
}

export const createServiceRequestSchema = z
  .object({
    vehicleId: z.string().trim().min(1, "Véhicule requis."),
    category: z.nativeEnum(ServiceCategory),
    description: z.string().trim().min(1, "Merci de décrire le problème.").max(2000),
    interventionType: z.nativeEnum(InterventionType),
    isUrgent: z.boolean().default(false),
    urgencyReason: z.nativeEnum(UrgencyReason).optional().nullable(),
    urgencyDescription: z.string().trim().max(1000).optional().or(z.literal("")),
    preferredDate: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Date invalide."),
    preferredSlot: z.enum(SLOT_VALUES).optional().nullable(),
    location: locationSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.interventionType === "MOBILE") {
      if (!data.location || !hasUsableLocation(data.location)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["location"],
          message: "La localisation est obligatoire pour une intervention mobile (position ou adresse).",
        });
      }
    }
    if (data.isUrgent && (!data.urgencyDescription || data.urgencyDescription.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["urgencyDescription"],
        message: "Merci de décrire brièvement la situation d'urgence.",
      });
    }
  });

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const rejectServiceRequestSchema = z.object({
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const acceptServiceRequestSchema = z.object({
  scheduledDate: z
    .string()
    .trim()
    .min(1, "Date requise.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide."),
  scheduledSlot: z.enum(SLOT_VALUES),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const rescheduleServiceRequestSchema = z.object({
  scheduledDate: z
    .string()
    .trim()
    .min(1, "Date requise.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide."),
  scheduledSlot: z.enum(SLOT_VALUES),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
