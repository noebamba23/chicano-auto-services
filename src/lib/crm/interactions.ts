import { db } from "@/lib/db";
import { CustomerNotFoundError } from "./errors";
import type { InteractionType } from "@prisma/client";

// Historique d'échanges (Phase 10) — réservé à la production (jamais
// exposé côté client, voir RBAC des routes appelantes). Contenu potentiel-
// lement sensible : uniquement retourné par les routes production, jamais
// par une route accessible au rôle CLIENT.

const PAGE_SIZE = 20;

export async function logInteraction(
  customerId: string,
  actorId: string,
  input: { type: InteractionType; subject?: string; content?: string }
) {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new CustomerNotFoundError();

  return db.customerInteraction.create({
    data: {
      customerId,
      actorId,
      type: input.type,
      subject: input.subject || null,
      content: input.content || null,
    },
  });
}

export async function listInteractionsForCustomer(customerId: string, page = 1) {
  const skip = Math.max(0, (page - 1) * PAGE_SIZE);
  const [items, total] = await Promise.all([
    db.customerInteraction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.customerInteraction.count({ where: { customerId } }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
