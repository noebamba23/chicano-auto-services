import { db } from "@/lib/db";
import { computeWorkOrderMargin } from "./service";

// KPI dashboard production/CEO (Phase 9) — calculés depuis les données
// réelles (paiements confirmés, factures, devis, Work Orders), jamais des
// valeurs inventées. Volontairement des requêtes simples (findMany + calcul
// en mémoire) plutôt que des agrégations Prisma avancées, pour rester
// testables avec le même fake db que le reste du projet.

export interface BusinessDashboardKpis {
  caJour: number;
  caMois: number;
  encaissementsMois: number;
  facturesEmises: number;
  facturesImpayees: number;
  interventionsMois: number;
  panierMoyen: number;
  tauxAcceptationDevis: number;
  margeBruteMois: number;
  clientsActifs: number;
  vehiculesActifs: number;
  clientsRecurrents: number;
}

export async function getBusinessDashboardKpis(): Promise<BusinessDashboardKpis> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [confirmedPayments, issuedInvoices, unpaidInvoices, completedWorkOrders, allQuotes, allWorkOrders] = await Promise.all([
    db.payment.findMany({ where: { status: "CONFIRMED" }, select: { amount: true, paidAt: true } }),
    db.invoice.findMany({ where: { status: { not: "DRAFT" } }, select: { total: true } }),
    db.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } }),
    db.workOrder.findMany({
      where: { status: "COMPLETED" },
      select: { id: true, updatedAt: true, customerId: true, vehicleId: true },
    }),
    db.quote.findMany({ where: {}, select: { status: true } }),
    db.workOrder.findMany({ where: {}, select: { customerId: true } }),
  ]);

  const caJour = confirmedPayments
    .filter((p) => p.paidAt && p.paidAt >= startOfDay)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const caMois = confirmedPayments
    .filter((p) => p.paidAt && p.paidAt >= startOfMonth)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const workOrdersThisMonth = completedWorkOrders.filter((wo) => wo.updatedAt >= startOfMonth);

  const panierMoyen =
    issuedInvoices.length > 0 ? issuedInvoices.reduce((sum, i) => sum + Number(i.total), 0) / issuedInvoices.length : 0;

  const quotesSentOrBeyond = allQuotes.filter((q) => q.status !== "DRAFT").length;
  const quotesAccepted = allQuotes.filter((q) => q.status === "ACCEPTED").length;
  const tauxAcceptationDevis = quotesSentOrBeyond > 0 ? (quotesAccepted / quotesSentOrBeyond) * 100 : 0;

  let margeBruteMois = 0;
  for (const wo of workOrdersThisMonth) {
    const margin = await computeWorkOrderMargin(wo.id);
    margeBruteMois += margin.grossMargin;
  }

  const clientsActifs = new Set(workOrdersThisMonth.map((wo) => wo.customerId)).size;
  const vehiculesActifs = new Set(workOrdersThisMonth.map((wo) => wo.vehicleId)).size;

  const countByCustomer = new Map<string, number>();
  for (const wo of allWorkOrders) countByCustomer.set(wo.customerId, (countByCustomer.get(wo.customerId) ?? 0) + 1);
  const clientsRecurrents = [...countByCustomer.values()].filter((count) => count > 1).length;

  return {
    caJour,
    caMois,
    encaissementsMois: caMois,
    facturesEmises: issuedInvoices.length,
    facturesImpayees: unpaidInvoices,
    interventionsMois: workOrdersThisMonth.length,
    panierMoyen,
    tauxAcceptationDevis,
    margeBruteMois,
    clientsActifs,
    vehiculesActifs,
    clientsRecurrents,
  };
}
