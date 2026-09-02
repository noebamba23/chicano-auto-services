import { db } from "@/lib/db";
import { computeBulkSegmentation } from "./segmentation";
import type { CampaignSegment, CustomerType } from "@prisma/client";

// Annuaire CRM production (Phase 10) — recherche/filtre/segmentation,
// borné à un nombre de requêtes fixe (computeBulkSegmentation() ne fait
// pas une requête par client) puis filtré/paginé en mémoire, même gabarit
// que getBusinessDashboardKpis() (Phase 9). Adapté à l'échelle réelle de
// ce commerce (quelques centaines de clients, pas des millions) — voir
// docs/CRM.md, section "Limites".

const PAGE_SIZE = 20;

export interface CrmDirectoryFilters {
  segment?: CampaignSegment;
  customerType?: CustomerType;
  search?: string;
  page?: number;
}

export async function listCustomersForCrm(filters: CrmDirectoryFilters = {}) {
  const [customers, segmentation] = await Promise.all([
    db.customer.findMany({
      select: {
        id: true,
        customerType: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, phoneE164: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    computeBulkSegmentation(),
  ]);

  const search = filters.search?.trim().toLowerCase();

  let rows = customers.map((c) => {
    const seg = segmentation.get(c.id);
    return {
      id: c.id,
      customerType: c.customerType,
      firstName: c.user.firstName,
      lastName: c.user.lastName,
      phoneE164: c.user.phoneE164,
      createdAt: c.createdAt,
      segment: seg?.segment ?? "NEW",
      journeyStage: seg?.journeyStage ?? "PROSPECT",
      atRiskReasons: seg?.signals.atRiskReasons ?? [],
    };
  });

  if (filters.segment) rows = rows.filter((r) => r.segment === filters.segment);
  if (filters.customerType) rows = rows.filter((r) => r.customerType === filters.customerType);
  if (search) {
    rows = rows.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
        r.phoneE164.toLowerCase().includes(search)
    );
  }

  const total = rows.length;
  const page = Math.max(1, filters.page ?? 1);
  const start = (page - 1) * PAGE_SIZE;
  const items = rows.slice(start, start + PAGE_SIZE);

  return { items, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function countCustomersBySegment(): Promise<Record<CampaignSegment, number>> {
  const segmentation = await computeBulkSegmentation();
  const counts: Record<CampaignSegment, number> = { NEW: 0, ACTIVE: 0, RECURRING: 0, DORMANT: 0, AT_RISK: 0, VIP: 0 };
  for (const s of segmentation.values()) counts[s.segment] += 1;
  return counts;
}
