import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(80),
  lastName: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  phone: z.string().trim().min(6, "Numéro WhatsApp invalide."),
  email: z.string().trim().email("Email invalide.").optional().or(z.literal("")),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  acceptedTerms: z.literal(true, {
    error: "Vous devez accepter les conditions d'utilisation.",
  }),
});

export const loginSchema = z.object({
  phone: z.string().trim().min(6, "Numéro invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export const verifyOtpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Le code doit contenir 6 chiffres."),
});
