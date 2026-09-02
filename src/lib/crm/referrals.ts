import { db } from "@/lib/db";
import { CustomerNotFoundError, ReferralConflictError } from "./errors";

// Parrainage (Phase 10) — architecture PRÉPARATOIRE uniquement. Pas de
// calcul de récompense automatique, pas de système d'affiliation complet :
// juste la trace du lien parrain/filleul et un statut suivi manuellement en
// production. Voir docs/CRM.md.

export async function createReferral(input: { referrerCustomerId: string; referredCustomerId: string }) {
  if (input.referrerCustomerId === input.referredCustomerId) {
    throw new ReferralConflictError("Un client ne peut pas se parrainer lui-même.");
  }

  const [referrer, referred] = await Promise.all([
    db.customer.findUnique({ where: { id: input.referrerCustomerId }, select: { id: true } }),
    db.customer.findUnique({ where: { id: input.referredCustomerId }, select: { id: true } }),
  ]);
  if (!referrer || !referred) throw new CustomerNotFoundError();

  const existing = await db.referral.findUnique({ where: { referredCustomerId: input.referredCustomerId } });
  if (existing) throw new ReferralConflictError("Ce client est déjà enregistré comme filleul.");

  const referral = await db.referral.create({ data: input });
  await db.auditLog.create({ data: { action: "REFERRAL_CREATED", entity: "Referral", entityId: referral.id } });
  return referral;
}

export function listReferralsForCustomer(customerId: string) {
  return db.referral.findMany({ where: { referrerCustomerId: customerId }, orderBy: { createdAt: "desc" } });
}

export async function updateReferralStatus(id: string, status: "QUALIFIED" | "REWARDED" | "CANCELLED") {
  const referral = await db.referral.findUnique({ where: { id } });
  if (!referral) throw new ReferralConflictError("Parrainage introuvable.");
  return db.referral.update({ where: { id }, data: { status } });
}
