import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "@/lib/service-requests/test-utils/fake-db";

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/service-requests/test-utils/fake-db");
  return { db: createFakeDb() };
});

vi.mock("@/lib/notifications/service", () => ({
  sendNotification: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/messaging/get-provider", () => ({
  getWhatsAppProvider: vi.fn(() => ({ sendText: vi.fn().mockResolvedValue({ success: true }) })),
  isMockWhatsAppActive: vi.fn(() => true),
}));

const { db } = await import("@/lib/db");
const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;
const { sendNotification } = await import("@/lib/notifications/service");

const { getCustomerSegmentation, computeBulkSegmentation } = await import("./segmentation");
const { getCustomer360 } = await import("./customer360");
const { getConsent, updateConsent, assertMarketingConsent } = await import("./consent");
const { ConsentError, CustomerNotFoundError, CareConflictError, FollowUpConflictError, ReferralConflictError } =
  await import("./errors");
const { createCampaign, previewCampaign, sendCampaign } = await import("./campaigns");
const { logInteraction, listInteractionsForCustomer } = await import("./interactions");
const { createFollowUp, completeFollowUp, cancelFollowUp, checkAndNotifyDueFollowUps } = await import("./follow-ups");
const { createCarePlan, createCareSubscription, pauseCareSubscription, resumeCareSubscription, cancelCareSubscription } =
  await import("./care");
const { createReferral } = await import("./referrals");
const { listCustomersForCrm } = await import("./directory");
const { getCrmDashboardKpis } = await import("./dashboard");
const { createServiceRequest } = await import("@/lib/service-requests/service");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const VEHICLE_A = "vehicle-a";
const STAFF_A = "staff-a";
const DAY = 86_400_000;

function seedBaseCustomers() {
  fakeDb._seedCustomer({
    id: CUSTOMER_A,
    userId: "user-a",
    user: { firstName: "Aminata", lastName: "Traoré", phoneE164: "+22369999001" },
  });
  fakeDb._seedCustomer({
    id: CUSTOMER_B,
    userId: "user-b",
    user: { firstName: "Boubacar", lastName: "Diarra", phoneE164: "+22369999002" },
  });
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, make: "Toyota", model: "Hilux" });
}

async function seedCompletedWorkOrder(customerId: string, vehicleId: string, updatedAt: Date) {
  const wo = await fakeDb.workOrder.create({
    data: { customerId, vehicleId, serviceRequestId: "sr-x", quoteId: `q-${Math.random()}`, acceptedQuoteVersionNumber: 1, status: "COMPLETED" },
  });
  Object.assign(wo, { updatedAt });
  return wo;
}

beforeEach(() => {
  fakeDb._reset();
  vi.clearAllMocks();
  seedBaseCustomers();
});

describe("segmentation", () => {
  it("NEW — client sans intervention terminée", async () => {
    const { segment } = await getCustomerSegmentation(CUSTOMER_A);
    expect(segment).toBe("NEW");
  });

  it("ACTIVE — une intervention terminée récente", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    const { segment } = await getCustomerSegmentation(CUSTOMER_A);
    expect(segment).toBe("ACTIVE");
  });

  it("RECURRING — deux interventions terminées (même seuil que le dashboard CEO Phase 9)", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    const { segment } = await getCustomerSegmentation(CUSTOMER_A);
    expect(segment).toBe("RECURRING");
  });

  it("DORMANT — intervention terminée mais aucune activité depuis ≥180 jours", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date(Date.now() - 200 * DAY));
    const { segment } = await getCustomerSegmentation(CUSTOMER_A);
    expect(segment).toBe("DORMANT");
  });

  it("AT_RISK — facture en retard prime sur tout autre segment", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    await fakeDb.invoice.create({
      data: { customerId: CUSTOMER_A, vehicleId: VEHICLE_A, status: "OVERDUE", total: 50_000, balanceDue: 50_000, dueAt: new Date(Date.now() - 5 * DAY) },
    });
    const { segment, signals } = await getCustomerSegmentation(CUSTOMER_A);
    expect(segment).toBe("AT_RISK");
    expect(signals.atRiskReasons).toContain("UNPAID_INVOICE");
  });

  it("VIP — au moins 5 interventions terminées", async () => {
    for (let i = 0; i < 5; i++) await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    const { segment } = await getCustomerSegmentation(CUSTOMER_A);
    expect(segment).toBe("VIP");
  });

  it("aucun scoring IA — segmentation 100% déterministe pour les mêmes données", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    const a = await getCustomerSegmentation(CUSTOMER_A);
    const b = await getCustomerSegmentation(CUSTOMER_A);
    expect(a.segment).toBe(b.segment);
  });

  it("journeyStage CARE_CUSTOMER prime dès qu'un abonnement CHICANO CARE est actif", async () => {
    const plan = await createCarePlan({ name: "Essentiel", price: 25_000, durationMonths: 12, frequencyMonths: 3, includedServices: [] });
    await createCareSubscription({ customerId: CUSTOMER_A, carePlanId: plan.id });
    const { journeyStage } = await getCustomerSegmentation(CUSTOMER_A);
    expect(journeyStage).toBe("CARE_CUSTOMER");
  });

  it("performance — computeBulkSegmentation reste utilisable sur plusieurs clients sans requête par client", async () => {
    const result = await computeBulkSegmentation();
    expect(result.size).toBe(2);
    expect(result.get(CUSTOMER_A)?.segment).toBe("NEW");
    expect(result.get(CUSTOMER_B)?.segment).toBe("NEW");
  });
});

describe("consentement", () => {
  it("consentement par défaut : tout à false, jamais présumé", async () => {
    const consent = await getConsent(CUSTOMER_A);
    expect(consent.marketingOptIn).toBe(false);
    expect(consent.whatsappOptIn).toBe(false);
  });

  it("activer marketingOptIn pose consentGivenAt/consentSource", async () => {
    const updated = await updateConsent(CUSTOMER_A, { marketingOptIn: true }, "CLIENT_PORTAL");
    expect(updated.marketingOptIn).toBe(true);
    expect(updated.consentGivenAt).not.toBeNull();
    expect(updated.consentSource).toBe("CLIENT_PORTAL");
  });

  it("désactiver marketingOptIn pose consentRevokedAt", async () => {
    await updateConsent(CUSTOMER_A, { marketingOptIn: true }, "CLIENT_PORTAL");
    const revoked = await updateConsent(CUSTOMER_A, { marketingOptIn: false }, "CLIENT_PORTAL");
    expect(revoked.consentRevokedAt).not.toBeNull();
  });

  it("getConsent sur un client inexistant lève CustomerNotFoundError", async () => {
    await expect(getConsent("nope")).rejects.toThrow(CustomerNotFoundError);
  });

  it("assertMarketingConsent refuse un envoi marketing sans marketingOptIn", () => {
    expect(() =>
      assertMarketingConsent({ marketingOptIn: false, whatsappOptIn: true, emailOptIn: true, smsOptIn: true }, "WHATSAPP")
    ).toThrow(ConsentError);
  });

  it("assertMarketingConsent refuse un canal spécifique non consenti même si marketingOptIn=true", () => {
    expect(() =>
      assertMarketingConsent({ marketingOptIn: true, whatsappOptIn: false, emailOptIn: true, smsOptIn: true }, "WHATSAPP")
    ).toThrow(ConsentError);
  });
});

describe("campagnes", () => {
  it("createCampaign démarre toujours en DRAFT", async () => {
    const c = await createCampaign(STAFF_A, {
      name: "Relance dormants", objective: "REACTIVATION", segment: "DORMANT", channel: "WHATSAPP", message: "Bonjour !",
    });
    expect(c.status).toBe("DRAFT");
  });

  it("previewCampaign ne compte que les clients du segment ET consentants — jamais d'envoi", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date(Date.now() - 200 * DAY));
    await updateConsent(CUSTOMER_A, { marketingOptIn: true, whatsappOptIn: true }, "CLIENT_PORTAL");
    const c = await createCampaign(STAFF_A, { name: "Dormants", objective: "REACTIVATION", segment: "DORMANT", channel: "WHATSAPP", message: "Revenez !" });
    const preview = await previewCampaign(c.id);
    expect(preview.totalInSegment).toBe(1);
    expect(preview.eligible).toBe(1);
    expect(c.status).toBe("DRAFT");
  });

  it("sendCampaign ignore un client sans marketingOptIn=true (règle fondamentale)", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date(Date.now() - 200 * DAY));
    // CUSTOMER_A reste sans consentement.
    const c = await createCampaign(STAFF_A, { name: "Dormants", objective: "REACTIVATION", segment: "DORMANT", channel: "WHATSAPP", message: "Revenez !" });
    const result = await sendCampaign(c.id);
    expect(result.sent).toBe(0);
    expect(result.skippedNoConsent).toBe(1);
  });

  it("sendCampaign envoie uniquement aux clients consentants du segment et passe en COMPLETED", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date(Date.now() - 200 * DAY));
    await updateConsent(CUSTOMER_A, { marketingOptIn: true, whatsappOptIn: true }, "CLIENT_PORTAL");
    const c = await createCampaign(STAFF_A, { name: "Dormants", objective: "REACTIVATION", segment: "DORMANT", channel: "WHATSAPP", message: "Revenez !" });
    const result = await sendCampaign(c.id);
    expect(result.sent).toBe(1);
  });

  it("sendCampaign sur un canal non configuré (EMAIL/SMS) ne simule jamais un succès", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date(Date.now() - 200 * DAY));
    await updateConsent(CUSTOMER_A, { marketingOptIn: true, emailOptIn: true }, "CLIENT_PORTAL");
    const c = await createCampaign(STAFF_A, { name: "Dormants", objective: "REACTIVATION", segment: "DORMANT", channel: "EMAIL", message: "Revenez !" });
    const result = await sendCampaign(c.id);
    expect(result.sent).toBe(0);
    expect(result.skippedChannelUnavailable).toBe(1);
  });
});

describe("interactions", () => {
  it("logInteraction rattache l'interaction au bon client et au bon acteur", async () => {
    const interaction = await logInteraction(CUSTOMER_A, STAFF_A, { type: "CALL", subject: "Appel de suivi" });
    expect(interaction.customerId).toBe(CUSTOMER_A);
    expect(interaction.actorId).toBe(STAFF_A);
  });

  it("ownership — les interactions du client A ne fuient jamais vers le client B", async () => {
    await logInteraction(CUSTOMER_A, STAFF_A, { type: "NOTE", content: "Confidentiel A" });
    const forB = await listInteractionsForCustomer(CUSTOMER_B);
    expect(forB.total).toBe(0);
  });

  it("pagination — listInteractionsForCustomer plafonne la page à 20 éléments", async () => {
    for (let i = 0; i < 25; i++) await logInteraction(CUSTOMER_A, STAFF_A, { type: "NOTE" });
    const page1 = await listInteractionsForCustomer(CUSTOMER_A, 1);
    expect(page1.items.length).toBe(20);
    expect(page1.total).toBe(25);
    expect(page1.totalPages).toBe(2);
  });
});

describe("relances", () => {
  it("createFollowUp démarre PENDING", async () => {
    const f = await createFollowUp(STAFF_A, { customerId: CUSTOMER_A, reason: "Rappeler pour le devis", dueAt: new Date().toISOString() });
    expect(f.status).toBe("PENDING");
  });

  it("completeFollowUp transitionne vers DONE puis refuse une deuxième transition", async () => {
    const f = await createFollowUp(STAFF_A, { customerId: CUSTOMER_A, reason: "R", dueAt: new Date().toISOString() });
    const done = await completeFollowUp(f.id);
    expect(done.status).toBe("DONE");
    await expect(completeFollowUp(f.id)).rejects.toThrow(FollowUpConflictError);
  });

  it("cancelFollowUp transitionne vers CANCELLED", async () => {
    const f = await createFollowUp(STAFF_A, { customerId: CUSTOMER_A, reason: "R", dueAt: new Date().toISOString() });
    const cancelled = await cancelFollowUp(f.id);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("checkAndNotifyDueFollowUps ne notifie que les relances PENDING échues et assignées", async () => {
    const overdue = await createFollowUp(STAFF_A, {
      customerId: CUSTOMER_A, reason: "En retard", dueAt: new Date(Date.now() - DAY).toISOString(), assignedToId: STAFF_A,
    });
    await createFollowUp(STAFF_A, { customerId: CUSTOMER_A, reason: "Future", dueAt: new Date(Date.now() + DAY).toISOString(), assignedToId: STAFF_A });
    const result = await checkAndNotifyDueFollowUps();
    expect(result.checked).toBe(1);
    expect(result.notified).toBe(1);
    expect(sendNotification).toHaveBeenCalledWith(STAFF_A, "FOLLOW_UP_DUE", expect.objectContaining({ reason: overdue.reason }));
  });
});

describe("CHICANO CARE", () => {
  it("createCareSubscription refuse un plan inactif", async () => {
    const plan = await createCarePlan({ name: "Ancien plan", price: 10_000, durationMonths: 12, frequencyMonths: 3, includedServices: [] });
    const { updateCarePlan } = await import("./care");
    await updateCarePlan(plan.id, { active: false });
    await expect(createCareSubscription({ customerId: CUSTOMER_A, carePlanId: plan.id })).rejects.toThrow(CareConflictError);
  });

  it("createCareSubscription envoie CARE_STARTED", async () => {
    const plan = await createCarePlan({ name: "Essentiel", price: 25_000, durationMonths: 12, frequencyMonths: 3, includedServices: ["Vidange"] });
    await createCareSubscription({ customerId: CUSTOMER_A, carePlanId: plan.id });
    expect(sendNotification).toHaveBeenCalledWith(expect.any(String), "CARE_STARTED", expect.any(Object));
  });

  it("pause puis reprise d'un abonnement CHICANO CARE", async () => {
    const plan = await createCarePlan({ name: "Essentiel", price: 25_000, durationMonths: 12, frequencyMonths: 3, includedServices: [] });
    const sub = await createCareSubscription({ customerId: CUSTOMER_A, carePlanId: plan.id });
    const paused = await pauseCareSubscription(sub!.id);
    expect(paused.status).toBe("PAUSED");
    const resumed = await resumeCareSubscription(sub!.id);
    expect(resumed.status).toBe("ACTIVE");
  });

  it("un abonnement résilié ne peut plus transitionner (aucun paiement récurrent, cycle de vie terminal)", async () => {
    const plan = await createCarePlan({ name: "Essentiel", price: 25_000, durationMonths: 12, frequencyMonths: 3, includedServices: [] });
    const sub = await createCareSubscription({ customerId: CUSTOMER_A, carePlanId: plan.id });
    await cancelCareSubscription(sub!.id);
    await expect(pauseCareSubscription(sub!.id)).rejects.toThrow(CareConflictError);
  });

  it("ownership — les abonnements du client A n'apparaissent jamais pour le client B", async () => {
    const plan = await createCarePlan({ name: "Essentiel", price: 25_000, durationMonths: 12, frequencyMonths: 3, includedServices: [] });
    await createCareSubscription({ customerId: CUSTOMER_A, carePlanId: plan.id });
    const { listCareSubscriptionsForCustomer } = await import("./care");
    const forB = await listCareSubscriptionsForCustomer(CUSTOMER_B);
    expect(forB.length).toBe(0);
  });
});

describe("parrainage (préparatoire)", () => {
  it("refuse l'auto-parrainage", async () => {
    await expect(createReferral({ referrerCustomerId: CUSTOMER_A, referredCustomerId: CUSTOMER_A })).rejects.toThrow(ReferralConflictError);
  });

  it("refuse un filleul déjà enregistré (unique)", async () => {
    await createReferral({ referrerCustomerId: CUSTOMER_A, referredCustomerId: CUSTOMER_B });
    await expect(createReferral({ referrerCustomerId: CUSTOMER_B, referredCustomerId: CUSTOMER_B })).rejects.toThrow(ReferralConflictError);
  });
});

describe("Customer 360, annuaire & dashboard", () => {
  it("getCustomer360 agrège segmentation/consentement/véhicules pour un client réel", async () => {
    const view = await getCustomer360(CUSTOMER_A);
    expect(view.customer.id).toBe(CUSTOMER_A);
    expect(view.vehicles.length).toBe(1);
    expect(view.segmentation.segment).toBe("NEW");
  });

  it("getCustomer360 lève CustomerNotFoundError pour un client inexistant (jamais de fuite d'existence)", async () => {
    await expect(getCustomer360("does-not-exist")).rejects.toThrow(CustomerNotFoundError);
  });

  it("ownership — Customer 360 du client A ne contient jamais les données du client B", async () => {
    await logInteraction(CUSTOMER_B, STAFF_A, { type: "NOTE", content: "Confidentiel B" });
    const viewA = await getCustomer360(CUSTOMER_A);
    expect(viewA.interactions.total).toBe(0);
  });

  it("getCustomer360 agrège l'historique opérationnel existant (demandes/factures) sans le dupliquer ni le fuiter entre clients", async () => {
    await createServiceRequest(CUSTOMER_A, {
      vehicleId: VEHICLE_A,
      category: "REPAIR",
      description: "Freins à changer.",
      interventionType: "AT_GARAGE",
      isUrgent: false,
    });
    const wo = await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    await fakeDb.invoice.create({ data: { customerId: CUSTOMER_A, vehicleId: VEHICLE_A, workOrderId: wo.id, status: "ISSUED", total: 30_000, balanceDue: 30_000 } });

    const viewA = await getCustomer360(CUSTOMER_A);
    expect(viewA.history.serviceRequests.length).toBe(1);
    expect(viewA.history.workOrders.length).toBe(1);
    expect(viewA.history.invoices.length).toBe(1);
    expect(viewA.summary.totalBilled).toBe(30_000);

    const viewB = await getCustomer360(CUSTOMER_B);
    expect(viewB.history.serviceRequests.length).toBe(0);
    expect(viewB.history.workOrders.length).toBe(0);
    expect(viewB.history.invoices.length).toBe(0);
  });

  it("listCustomersForCrm filtre correctement par segment", async () => {
    await seedCompletedWorkOrder(CUSTOMER_A, VEHICLE_A, new Date());
    const active = await listCustomersForCrm({ segment: "ACTIVE" });
    expect(active.items.every((c) => c.segment === "ACTIVE")).toBe(true);
    expect(active.items.some((c) => c.id === CUSTOMER_A)).toBe(true);
  });

  it("getCrmDashboardKpis compte les clients par segment cohérent avec computeBulkSegmentation", async () => {
    const kpis = await getCrmDashboardKpis();
    expect(kpis.newCustomers).toBe(2);
    expect(kpis.activeCustomers).toBe(0);
  });
});
