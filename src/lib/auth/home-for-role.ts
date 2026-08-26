import type { UserRole } from "@prisma/client";

// Source unique de la page d'accueil par rôle — utilisée à la fois par
// src/proxy.ts (redirections de garde) et la route de connexion (redirection
// post-login), pour ne jamais désynchroniser les deux (section "Phase 5 —
// espace technicien" : avant cette phase, tous les rôles atterrissaient sur
// /espace-client par défaut, y compris production/technicien).
const PRODUCTION_ROLES: readonly UserRole[] = ["PRODUCTION_STAFF", "ADMIN", "SUPER_ADMIN"];

export function homeForRole(role: UserRole): string {
  if (PRODUCTION_ROLES.includes(role)) return "/production/demandes";
  if (role === "TECHNICIAN") return "/technicien";
  return "/espace-client";
}
