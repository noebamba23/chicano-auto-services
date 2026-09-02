import { db } from "@/lib/db";
import { computeReminderLevel } from "@/lib/maintenance/service";
import {
  DORMANT_THRESHOLD_DAYS,
  VIP_REVENUE_THRESHOLD_XOF,
  VIP_WORK_ORDER_THRESHOLD,
  RECURRING_WORK_ORDER_THRESHOLD,
  REFUSED_QUOTE_WINDOW_DAYS,
  INTERRUPTED_WORK_ORDER_DAYS,
  AT_RISK_INACTIVITY_DAYS,
} from "./config";
import type { CampaignSegment } from "@prisma/client";

// Segmentation (Phase 10) — RÈGLE FONDAMENTALE : jamais d'IA de scoring,
// jamais de champ stocké à resynchroniser. Chaque segment/étape de parcours
// est une fonction PURE calculée à la volée depuis des données réelles
// (ServiceRequest/WorkOrder/Invoice/Quote/MaintenanceReminder/
// CareSubscription), même discipline que MaintenanceReminderLevel
// (Phase 8). Voir docs/CRM.md pour la table de vérité complète des règles.
//
// Performance : une seule volée de requêtes groupées (jamais une requête
// par client), résultat mis en Map pour un accès O(1) — voir
// gatherCustomerSignals().

export type CustomerJourneyStage =
  | "PROSPECT"
  | "NEW_CUSTOMER"
  | "ACTIVE_CUSTOMER"
  | "RECURRING_CUSTOMER"
  | "CARE_CUSTOMER"
  | "DORMANT"
  | "AT_RISK";

export type AtRiskReason =
  | "REFUSED_QUOTE"
  | "OVERDUE_MAINTENANCE"
  | "UNPAID_INVOICE"
  | "INTERRUPTED_WORK_ORDER"
  | "LONG_INACTIVITY";

export interface CustomerSignals {
  customerId: string;
  createdAt: Date;
  vehicleCount: number;
  completedWorkOrders: number;
  totalRevenuePaid: number;
  lastActivityAt: Date | null;
  hasActiveCare: boolean;
  atRiskReasons: AtRiskReason[];
}

export interface CustomerSegmentation {
  signals: CustomerSignals;
  segment: CampaignSegment;
  journeyStage: CustomerJourneyStage;
}

function daysSince(date: Date | null, now: number): number | null {
  if (!date) return null;
  return (now - date.getTime()) / 86_400_000;
}

// Une seule volée de requêtes (findMany, jamais une requête par client),
// résultat réduit en mémoire — même gabarit que
// getBusinessDashboardKpis() (Phase 9, src/lib/billing/dashboard.ts).
export async function gatherCustomerSignals(customerIds?: string[]): Promise<Map<string, CustomerSignals>> {
  const customerFilter = customerIds ? { id: { in: customerIds } } : {};
  const relatedFilter = customerIds ? { customerId: { in: customerIds } } : {};

  const [customers, vehicles, workOrders, invoices, confirmedPayments, refusedQuotes, activeReminders, careSubs] =
    await Promise.all([
      db.customer.findMany({ where: customerFilter, select: { id: true, createdAt: true } }),
      db.vehicle.findMany({ where: relatedFilter, select: { id: true, customerId: true, mileage: true } }),
      db.workOrder.findMany({
        where: relatedFilter,
        select: { customerId: true, status: true, updatedAt: true },
      }),
      db.invoice.findMany({
        where: relatedFilter,
        select: { customerId: true, status: true, balanceDue: true, dueAt: true, issuedAt: true },
      }),
      db.payment.findMany({
        where: { status: "CONFIRMED", ...(customerIds ? { customerId: { in: customerIds } } : {}) },
        select: { customerId: true, amount: true, paidAt: true },
      }),
      db.quote.findMany({
        where: { status: "REJECTED" },
        select: { updatedAt: true, vehicle: { select: { customerId: true } } },
      }),
      db.maintenanceReminder.findMany({
        where: { status: { in: ["SCHEDULED", "PENDING"] } },
        select: { dueAt: true, dueMileage: true, vehicle: { select: { customerId: true, mileage: true } } },
      }),
      db.careSubscription.findMany({
        where: { status: "ACTIVE", ...(customerIds ? { customerId: { in: customerIds } } : {}) },
        select: { customerId: true },
      }),
    ]);

  const now = Date.now();
  const signals = new Map<string, CustomerSignals>();

  for (const c of customers) {
    signals.set(c.id, {
      customerId: c.id,
      createdAt: c.createdAt,
      vehicleCount: 0,
      completedWorkOrders: 0,
      totalRevenuePaid: 0,
      lastActivityAt: null,
      hasActiveCare: false,
      atRiskReasons: [],
    });
  }

  const bump = (customerId: string, at: Date | null | undefined) => {
    const s = signals.get(customerId);
    if (!s) return;
    if (at && (!s.lastActivityAt || at > s.lastActivityAt)) s.lastActivityAt = at;
  };

  for (const v of vehicles) {
    const s = signals.get(v.customerId);
    if (s) s.vehicleCount += 1;
  }

  for (const wo of workOrders) {
    bump(wo.customerId, wo.updatedAt);
    if (wo.status === "COMPLETED") {
      const s = signals.get(wo.customerId);
      if (s) s.completedWorkOrders += 1;
    }
    // Intervention interrompue : bloquée depuis plus de
    // INTERRUPTED_WORK_ORDER_DAYS jours sur ON_HOLD/WAITING_PARTS.
    if (wo.status === "ON_HOLD" || wo.status === "WAITING_PARTS") {
      const stuckDays = daysSince(wo.updatedAt, now);
      if (stuckDays !== null && stuckDays >= INTERRUPTED_WORK_ORDER_DAYS) {
        const s = signals.get(wo.customerId);
        if (s && !s.atRiskReasons.includes("INTERRUPTED_WORK_ORDER")) s.atRiskReasons.push("INTERRUPTED_WORK_ORDER");
      }
    }
  }

  for (const inv of invoices) {
    bump(inv.customerId, inv.issuedAt);
    const overdue = inv.status === "OVERDUE" || (Number(inv.balanceDue) > 0 && inv.dueAt !== null && inv.dueAt < new Date(now));
    if (overdue) {
      const s = signals.get(inv.customerId);
      if (s && !s.atRiskReasons.includes("UNPAID_INVOICE")) s.atRiskReasons.push("UNPAID_INVOICE");
    }
  }

  for (const p of confirmedPayments) {
    const s = signals.get(p.customerId);
    if (s) {
      s.totalRevenuePaid += Number(p.amount);
      bump(p.customerId, p.paidAt);
    }
  }

  const refusedWindowStart = now - REFUSED_QUOTE_WINDOW_DAYS * 86_400_000;
  for (const q of refusedQuotes) {
    const customerId = q.vehicle?.customerId;
    if (!customerId || !q.updatedAt || q.updatedAt.getTime() < refusedWindowStart) continue;
    const s = signals.get(customerId);
    if (s && !s.atRiskReasons.includes("REFUSED_QUOTE")) s.atRiskReasons.push("REFUSED_QUOTE");
  }

  for (const r of activeReminders) {
    const customerId = r.vehicle?.customerId;
    if (!customerId) continue;
    const level = computeReminderLevel({ dueAt: r.dueAt, dueMileage: r.dueMileage }, r.vehicle?.mileage ?? null);
    if (level === "OVERDUE") {
      const s = signals.get(customerId);
      if (s && !s.atRiskReasons.includes("OVERDUE_MAINTENANCE")) s.atRiskReasons.push("OVERDUE_MAINTENANCE");
    }
  }

  for (const cs of careSubs) {
    const s = signals.get(cs.customerId);
    if (s) s.hasActiveCare = true;
  }

  // "Longue inactivité" — alerte précoce, dernier signal après agrégation
  // de toutes les sources ci-dessus (ne peut être jugée qu'une fois toute
  // l'activité connue rassemblée). Fenêtre [AT_RISK_INACTIVITY_DAYS,
  // DORMANT_THRESHOLD_DAYS) uniquement — au-delà, le client devient DORMANT
  // (état confirmé distinct, voir computeSegment), jamais les deux à la fois.
  for (const s of signals.values()) {
    const inactivityDays = daysSince(s.lastActivityAt ?? s.createdAt, now);
    if (
      inactivityDays !== null &&
      inactivityDays >= AT_RISK_INACTIVITY_DAYS &&
      inactivityDays < DORMANT_THRESHOLD_DAYS &&
      s.completedWorkOrders > 0
    ) {
      if (!s.atRiskReasons.includes("LONG_INACTIVITY")) s.atRiskReasons.push("LONG_INACTIVITY");
    }
  }

  return signals;
}

// Priorité (le premier qui matche l'emporte) : AT_RISK > DORMANT > VIP >
// RECURRING > ACTIVE > NEW. Voir docs/CRM.md pour la table de vérité et la
// justification de chaque seuil.
export function computeSegment(signals: CustomerSignals, now = Date.now()): CampaignSegment {
  if (signals.atRiskReasons.length > 0) return "AT_RISK";

  const inactivityDays = daysSince(signals.lastActivityAt ?? signals.createdAt, now);
  if (inactivityDays !== null && inactivityDays >= DORMANT_THRESHOLD_DAYS && signals.completedWorkOrders > 0) {
    return "DORMANT";
  }

  if (signals.totalRevenuePaid >= VIP_REVENUE_THRESHOLD_XOF || signals.completedWorkOrders >= VIP_WORK_ORDER_THRESHOLD) {
    return "VIP";
  }

  if (signals.completedWorkOrders >= RECURRING_WORK_ORDER_THRESHOLD) return "RECURRING";
  if (signals.completedWorkOrders >= 1) return "ACTIVE";
  return "NEW";
}

// Parcours client — distinct de la segmentation comportementale (au-dessus
// : ciblage commercial/marketing) : ici, l'étape de la relation dans le
// temps. CARE_CUSTOMER prime sur tout le reste (c'est le palier
// relationnel le plus engagé qu'offre la plateforme).
export function computeJourneyStage(signals: CustomerSignals, now = Date.now()): CustomerJourneyStage {
  if (signals.hasActiveCare) return "CARE_CUSTOMER";
  if (signals.atRiskReasons.length > 0) return "AT_RISK";

  const inactivityDays = daysSince(signals.lastActivityAt ?? signals.createdAt, now);
  if (inactivityDays !== null && inactivityDays >= DORMANT_THRESHOLD_DAYS && signals.completedWorkOrders > 0) {
    return "DORMANT";
  }

  if (signals.completedWorkOrders >= RECURRING_WORK_ORDER_THRESHOLD) return "RECURRING_CUSTOMER";
  if (signals.completedWorkOrders >= 1) return "ACTIVE_CUSTOMER";
  if (signals.vehicleCount > 0) return "NEW_CUSTOMER";
  return "PROSPECT";
}

export async function getCustomerSegmentation(customerId: string): Promise<CustomerSegmentation> {
  const signals = (await gatherCustomerSignals([customerId])).get(customerId);
  if (!signals) {
    const empty: CustomerSignals = {
      customerId,
      createdAt: new Date(),
      vehicleCount: 0,
      completedWorkOrders: 0,
      totalRevenuePaid: 0,
      lastActivityAt: null,
      hasActiveCare: false,
      atRiskReasons: [],
    };
    return { signals: empty, segment: computeSegment(empty), journeyStage: computeJourneyStage(empty) };
  }
  return { signals, segment: computeSegment(signals), journeyStage: computeJourneyStage(signals) };
}

export async function computeBulkSegmentation(customerIds?: string[]): Promise<Map<string, CustomerSegmentation>> {
  const signalsMap = await gatherCustomerSignals(customerIds);
  const result = new Map<string, CustomerSegmentation>();
  for (const [id, signals] of signalsMap) {
    result.set(id, { signals, segment: computeSegment(signals), journeyStage: computeJourneyStage(signals) });
  }
  return result;
}
