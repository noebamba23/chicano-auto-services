import { db } from "@/lib/db";
import { computeBulkSegmentation } from "./segmentation";
import { computeReminderLevel } from "@/lib/maintenance/service";
import { DORMANT_THRESHOLD_DAYS } from "./config";

// Dashboards CRM & CEO (Phase 10) — mêmes principes que
// getBusinessDashboardKpis() (Phase 9) : requêtes simples + calcul en
// mémoire, jamais de valeur inventée. Le "taux rappel → rendez-vous" est
// une APPROXIMATION documentée (aucun lien stocké entre un
// MaintenanceReminder et le ServiceRequest qu'il a pu générer — voir
// docs/CRM.md, section "Limites") : mesure la proportion de rappels
// "arrivés à échéance" qui ont effectivement été complétés dans le mois,
// pas un funnel exact.

export interface CrmDashboardKpis {
  newCustomers: number;
  activeCustomers: number;
  recurringCustomers: number;
  dormantCustomers: number;
  atRiskCustomers: number;
  vipCustomers: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  dueReminders: number;
  overdueReminders: number;
  campaignsDraft: number;
  campaignsRunningOrScheduled: number;
  activeCareSubscriptions: number;
  careAdoptionRate: number;
}

export async function getCrmDashboardKpis(): Promise<CrmDashboardKpis> {
  const now = new Date();

  const [segmentation, totalCustomers, followUps, activeReminders, campaigns, activeCareCount] = await Promise.all([
    computeBulkSegmentation(),
    db.customer.count({ where: {} }),
    db.followUp.findMany({ where: { status: "PENDING" }, select: { dueAt: true } }),
    db.maintenanceReminder.findMany({
      where: { status: { in: ["SCHEDULED", "PENDING"] } },
      select: { dueAt: true, dueMileage: true, vehicle: { select: { mileage: true } } },
    }),
    db.campaign.findMany({ select: { status: true } }),
    db.careSubscription.count({ where: { status: "ACTIVE" } }),
  ]);

  const counts = { NEW: 0, ACTIVE: 0, RECURRING: 0, DORMANT: 0, AT_RISK: 0, VIP: 0 } as Record<string, number>;
  for (const s of segmentation.values()) counts[s.segment] += 1;

  const overdueFollowUps = followUps.filter((f) => f.dueAt < now).length;

  let dueReminders = 0;
  let overdueReminders = 0;
  for (const r of activeReminders) {
    const level = computeReminderLevel({ dueAt: r.dueAt, dueMileage: r.dueMileage }, r.vehicle?.mileage ?? null);
    if (level === "DUE") dueReminders += 1;
    if (level === "OVERDUE") overdueReminders += 1;
  }

  return {
    newCustomers: counts.NEW,
    activeCustomers: counts.ACTIVE,
    recurringCustomers: counts.RECURRING,
    dormantCustomers: counts.DORMANT,
    atRiskCustomers: counts.AT_RISK,
    vipCustomers: counts.VIP,
    pendingFollowUps: followUps.length,
    overdueFollowUps,
    dueReminders,
    overdueReminders,
    campaignsDraft: campaigns.filter((c) => c.status === "DRAFT").length,
    campaignsRunningOrScheduled: campaigns.filter((c) => c.status === "RUNNING" || c.status === "SCHEDULED").length,
    activeCareSubscriptions: activeCareCount,
    careAdoptionRate: totalCustomers > 0 ? (activeCareCount / totalCustomers) * 100 : 0,
  };
}

export interface CrmCeoKpis {
  reactivatedCustomersThisMonth: number;
  caMoyenParClient: number;
  interventionsParClient: number;
  tauxRappelRendezVous: number;
  tauxChicanoCare: number;
}

export async function getCrmCeoKpis(): Promise<CrmCeoKpis> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [workOrders, invoices, totalCustomers, activeCareCount, completedReminders, activeReminders] = await Promise.all([
    db.workOrder.findMany({ where: { status: "COMPLETED" }, select: { customerId: true, updatedAt: true } }),
    db.invoice.findMany({ where: { status: { not: "DRAFT" } }, select: { customerId: true, total: true } }),
    db.customer.count({ where: {} }),
    db.careSubscription.count({ where: { status: "ACTIVE" } }),
    db.maintenanceReminder.findMany({ where: { status: "COMPLETED", completedAt: { gte: startOfMonth } }, select: { id: true } }),
    db.maintenanceReminder.findMany({
      where: { status: { in: ["SCHEDULED", "PENDING"] } },
      select: { dueAt: true, dueMileage: true, vehicle: { select: { mileage: true } } },
    }),
  ]);

  const byCustomer = new Map<string, Date[]>();
  for (const wo of workOrders) {
    const list = byCustomer.get(wo.customerId) ?? [];
    list.push(wo.updatedAt);
    byCustomer.set(wo.customerId, list);
  }

  let reactivatedCustomersThisMonth = 0;
  for (const dates of byCustomer.values()) {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const gapDays = (sorted[i].getTime() - sorted[i - 1].getTime()) / 86_400_000;
      if (gapDays >= DORMANT_THRESHOLD_DAYS && sorted[i] >= startOfMonth) {
        reactivatedCustomersThisMonth += 1;
        break;
      }
    }
  }

  const revenueByCustomer = new Map<string, number>();
  for (const inv of invoices) revenueByCustomer.set(inv.customerId, (revenueByCustomer.get(inv.customerId) ?? 0) + Number(inv.total));
  const activeCustomerCount = byCustomer.size || 1;
  const caMoyenParClient = [...revenueByCustomer.values()].reduce((s, v) => s + v, 0) / activeCustomerCount;
  const interventionsParClient = workOrders.length / activeCustomerCount;

  let overdueOrDueMatured = 0;
  for (const r of activeReminders) {
    const level = computeReminderLevel({ dueAt: r.dueAt, dueMileage: r.dueMileage }, r.vehicle?.mileage ?? null);
    if (level === "DUE" || level === "OVERDUE") overdueOrDueMatured += 1;
  }
  const maturedTotal = completedReminders.length + overdueOrDueMatured;
  const tauxRappelRendezVous = maturedTotal > 0 ? (completedReminders.length / maturedTotal) * 100 : 0;

  return {
    reactivatedCustomersThisMonth,
    caMoyenParClient,
    interventionsParClient,
    tauxRappelRendezVous,
    tauxChicanoCare: totalCustomers > 0 ? (activeCareCount / totalCustomers) * 100 : 0,
  };
}
