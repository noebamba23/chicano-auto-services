import { db } from "@/lib/db";
import { getCustomerSegmentation } from "./segmentation";
import { listInteractionsForCustomer } from "./interactions";
import { listFollowUpsForCustomer } from "./follow-ups";
import { listCareSubscriptionsForCustomer } from "./care";
import { listReferralsForCustomer } from "./referrals";
import { listServiceRequestsForCustomer } from "@/lib/service-requests/service";
import { listAppointmentsForCustomer } from "@/lib/appointments/service";
import { listQuotesForCustomer } from "@/lib/quotes/service";
import { listWorkOrdersForCustomer } from "@/lib/work-orders/service";
import { listInvoicesForProduction } from "@/lib/billing/service";
import { listPublishedReportsForCustomer } from "@/lib/reports/service";
import { CustomerNotFoundError } from "./errors";

// Customer 360 (Phase 10) — RÈGLE FONDAMENTALE : ne duplique aucune donnée
// métier déjà servie ailleurs, n'introduit aucun deuxième moteur. Chaque
// domaine (demandes/rendez-vous/diagnostics/devis/work orders/factures/
// paiements) est lu via la fonction "ForCustomer" DÉJÀ existante du domaine
// concerné (service-requests, appointments, quotes, work-orders, billing,
// reports) — jamais une requête réinventée ici. Les paiements ne sont pas
// requêtés séparément : ils voyagent déjà avec chaque facture
// (Invoice.payments, voir billing/service.ts) — aucun nouveau moteur
// financier.
//
// Liens : chaque section pointe vers la page détail PRODUCTION existante
// quand elle existe (ServiceRequest → /production/demandes/[id], WorkOrder
// → /production/work-orders/[id], Invoice → /production/facturation/[id]).
// Le diagnostic/rapport et le devis n'ont pas de page dédiée : ils sont déjà
// affichés en ligne sur la fiche ServiceRequest — donc pas de nouveau lien,
// juste le résumé ici (voir docs/CRM.md, section "Liens Customer 360").
//
// Nombre de requêtes borné (~15) quel que soit le volume d'historique —
// fixe, jamais une requête par élément de liste (pas de N+1). Pagination
// sur interactions/relances (seules listes potentiellement longues dans le
// temps) ; les autres domaines restent à l'échelle d'un client (quelques
// dizaines d'éléments au plus), listés en entier comme déjà fait ailleurs
// (ex. src/app/espace-client/factures/page.tsx).

export async function getCustomer360(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: { user: { select: { firstName: true, lastName: true, phoneE164: true, email: true, createdAt: true } } },
  });
  if (!customer) throw new CustomerNotFoundError();

  const [
    vehicles,
    segmentation,
    careSubscriptions,
    interactions,
    followUps,
    referrals,
    reminders,
    serviceRequests,
    appointments,
    quotes,
    workOrders,
    invoices,
    reports,
    workOrderCount,
  ] = await Promise.all([
    db.vehicle.findMany({
      where: { customerId },
      select: { id: true, make: true, model: true, chicanoVehicleId: true, licensePlate: true, isPrimary: true, mileage: true },
    }),
    getCustomerSegmentation(customerId),
    listCareSubscriptionsForCustomer(customerId),
    listInteractionsForCustomer(customerId, 1),
    listFollowUpsForCustomer(customerId, 1),
    listReferralsForCustomer(customerId),
    db.maintenanceReminder.findMany({
      where: { status: { in: ["SCHEDULED", "PENDING"] }, vehicle: { customerId } },
      select: { id: true, type: true, dueAt: true, dueMileage: true, vehicleId: true },
    }),
    listServiceRequestsForCustomer(customerId),
    listAppointmentsForCustomer(customerId),
    listQuotesForCustomer(customerId),
    listWorkOrdersForCustomer(customerId),
    listInvoicesForProduction({ customerId }),
    listPublishedReportsForCustomer(customerId),
    db.workOrder.count({ where: { customerId, status: "COMPLETED" } }),
  ]);

  // Résumé "Total facturé" — uniquement les factures réellement émises
  // (DRAFT exclu, même règle que partout ailleurs : un brouillon n'engage
  // rien). La liste complète (history.invoices), elle, inclut les DRAFT —
  // la production doit voir qu'un Work Order terminé a généré une facture
  // encore en attente d'émission.
  const issuedInvoices = invoices.filter((i) => i.status !== "DRAFT");
  const totalBilled = issuedInvoices.reduce((sum, i) => sum + Number(i.total), 0);
  const unpaidCount = issuedInvoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").length;

  return {
    customer: {
      id: customer.id,
      customerType: customer.customerType,
      crmStage: customer.crmStage,
      firstName: customer.user.firstName,
      lastName: customer.user.lastName,
      phoneE164: customer.user.phoneE164,
      email: customer.user.email,
      memberSince: customer.user.createdAt,
    },
    consent: {
      whatsappOptIn: customer.whatsappOptIn,
      emailOptIn: customer.emailOptIn,
      smsOptIn: customer.smsOptIn,
      marketingOptIn: customer.marketingOptIn,
      consentGivenAt: customer.consentGivenAt,
      consentSource: customer.consentSource,
      consentRevokedAt: customer.consentRevokedAt,
    },
    vehicles,
    segmentation,
    careSubscriptions,
    interactions,
    followUps,
    referrals,
    reminders,
    // Historique opérationnel — agrégé depuis les domaines existants,
    // jamais dupliqué. `payments` de chaque facture est déjà inclus dans
    // `invoices` (voir INVOICE_INCLUDE, billing/service.ts).
    history: {
      serviceRequests,
      appointments,
      quotes,
      workOrders,
      invoices,
      reports,
    },
    summary: {
      completedWorkOrders: workOrderCount,
      totalBilled,
      unpaidInvoices: unpaidCount,
    },
  };
}
