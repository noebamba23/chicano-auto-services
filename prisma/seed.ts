import { PrismaClient, NotificationEvent, NotificationChannel, TechnicianSkill } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Templates de notification WhatsApp — section 50 du prompt maître.
// {{variable}} sera interpolé au moment de l'envoi par le service de
// notification (à construire en phase 4+).
const TEMPLATES: { event: NotificationEvent; body: string }[] = [
  { event: "ACCOUNT_VERIFIED", body: "CHICANO AUTO SERVICES\nVotre compte est vérifié. Bienvenue {{firstName}} !" },
  { event: "REQUEST_RECEIVED", body: "CHICANO AUTO SERVICES\nVotre demande {{reference}} a bien été reçue. Notre équipe va l'étudier et vous confirmer la prise en charge." },
  { event: "REQUEST_ACCEPTED", body: "CHICANO AUTO SERVICES\nVotre demande {{reference}} est acceptée.\nVéhicule : {{vehicle}}\nDate proposée : {{date}} — {{slot}}." },
  { event: "REQUEST_REJECTED", body: "CHICANO AUTO SERVICES\nVotre demande {{reference}} n'a pas pu être retenue.{{reason}}" },
  { event: "RESCHEDULE_REQUESTED", body: "CHICANO AUTO SERVICES\nCHICANO vous propose un autre créneau pour votre demande {{reference}} : {{date}} — {{slot}}." },
  { event: "APPOINTMENT_ACCEPTED", body: "CHICANO AUTO SERVICES\nVotre rendez-vous est confirmé.\nVéhicule : {{vehicle}}\nDate : {{date}}\nHeure : {{time}}\nType : {{interventionType}}." },
  { event: "APPOINTMENT_CONFIRMED", body: "CHICANO AUTO SERVICES\nVotre rendez-vous pour {{reference}} est confirmé : {{date}} — {{slot}}." },
  { event: "APPOINTMENT_RESCHEDULED", body: "CHICANO AUTO SERVICES\nVotre rendez-vous a été replanifié.\nNouvelle date : {{date}} à {{time}}." },
  { event: "APPOINTMENT_CANCELLED", body: "CHICANO AUTO SERVICES\nVotre rendez-vous pour {{reference}} a été annulé." },
  { event: "TECHNICIAN_ASSIGNED", body: "CHICANO AUTO SERVICES\nUn technicien a été affecté à votre intervention." },
  { event: "TECHNICIAN_EN_ROUTE", body: "CHICANO AUTO SERVICES\nVotre technicien CHICANO est en route." },
  { event: "TECHNICIAN_ARRIVED", body: "CHICANO AUTO SERVICES\nVotre technicien CHICANO est arrivé sur place." },
  { event: "DIAGNOSTIC_COMPLETED", body: "CHICANO AUTO SERVICES\nLe diagnostic de votre véhicule est terminé." },
  { event: "REPORT_AVAILABLE", body: "CHICANO AUTO SERVICES\nVotre rapport de diagnostic est disponible." },
  { event: "QUOTE_AVAILABLE", body: "CHICANO AUTO SERVICES\nVotre devis est disponible. Consultez-le pour validation." },
  { event: "QUOTE_ACCEPTED", body: "CHICANO AUTO SERVICES\nVotre devis a été accepté. La réparation va débuter." },
  { event: "REPAIR_COMPLETED", body: "CHICANO AUTO SERVICES\nLa réparation de votre véhicule est terminée." },
  { event: "VEHICLE_READY", body: "CHICANO AUTO SERVICES\nVotre véhicule est prêt à être récupéré." },
  { event: "INVOICE_AVAILABLE", body: "CHICANO AUTO SERVICES\nVotre facture est disponible." },
  { event: "MAINTENANCE_REMINDER", body: "CHICANO AUTO SERVICES\nUn entretien approche pour votre véhicule {{vehicle}} ({{maintenanceType}})." },
  { event: "WORK_ORDER_CREATED", body: "CHICANO AUTO SERVICES\nVotre ordre de réparation {{reference}} a été créé suite à l'acceptation de votre devis." },
  { event: "WORK_SCHEDULED", body: "CHICANO AUTO SERVICES\nVotre réparation {{reference}} est planifiée le {{date}}." },
  { event: "WORK_STARTED", body: "CHICANO AUTO SERVICES\nLes travaux sur votre véhicule ont commencé." },
  { event: "WORK_WAITING_PARTS", body: "CHICANO AUTO SERVICES\nVos travaux sont en attente de pièces. Nous vous tiendrons informé." },
  // Signal interne production, jamais envoyé (voir docs/WORK-ORDERS.md) —
  // template posé pour complétude uniquement.
  { event: "QUALITY_CHECK_REQUIRED", body: "CHICANO AUTO SERVICES\nContrôle qualité requis pour l'ordre {{reference}}." },
  { event: "WORK_COMPLETED", body: "CHICANO AUTO SERVICES\nLa réparation de votre véhicule est terminée. Votre véhicule est prêt." },
  { event: "ADDITIONAL_WORK_REQUIRED", body: "CHICANO AUTO SERVICES\nDes travaux supplémentaires ont été identifiés sur l'ordre {{reference}}." },
  { event: "MAINTENANCE_UPCOMING", body: "CHICANO AUTO SERVICES\nUn entretien approche pour votre véhicule {{vehicle}} : {{maintenanceType}}." },
  { event: "MAINTENANCE_DUE", body: "CHICANO AUTO SERVICES\nVotre entretien {{maintenanceType}} pour {{vehicle}} arrive à échéance." },
  { event: "MAINTENANCE_OVERDUE", body: "CHICANO AUTO SERVICES\nVotre entretien {{maintenanceType}} pour {{vehicle}} est en retard." },
  { event: "INVOICE_ISSUED", body: "CHICANO AUTO SERVICES\nVotre facture {{reference}} est disponible." },
  { event: "PAYMENT_RECEIVED", body: "CHICANO AUTO SERVICES\nNous avons bien reçu votre paiement de {{amount}} F CFA pour la facture {{reference}}." },
  { event: "PAYMENT_PARTIAL", body: "CHICANO AUTO SERVICES\nAcompte de {{amount}} F CFA reçu pour la facture {{reference}}. Solde restant à régler." },
  { event: "INVOICE_PAID", body: "CHICANO AUTO SERVICES\nVotre facture {{reference}} est intégralement réglée. Merci !" },
  { event: "PAYMENT_FAILED", body: "CHICANO AUTO SERVICES\nVotre tentative de paiement pour la facture {{reference}} n'a pas abouti." },
  // CRM & CHICANO CARE (Phase 10). Destinataire de FOLLOW_UP_DUE : le
  // membre du personnel assigné (jamais le client, voir docs/CRM.md).
  { event: "CARE_STARTED", body: "CHICANO AUTO SERVICES\nBienvenue dans CHICANO CARE ! Votre abonnement {{plan}} est actif." },
  { event: "CARE_EXPIRING", body: "CHICANO AUTO SERVICES\nVotre abonnement CHICANO CARE {{plan}} arrive bientôt à échéance." },
  { event: "CARE_EXPIRED", body: "CHICANO AUTO SERVICES\nVotre abonnement CHICANO CARE {{plan}} est arrivé à échéance." },
  { event: "FOLLOW_UP_DUE", body: "CHICANO CONTROL CENTER\nRelance à effectuer : {{reason}}." },
];

async function main() {
  for (const t of TEMPLATES) {
    await db.notificationTemplate.upsert({
      where: { event: t.event },
      update: { bodyTemplate: t.body },
      create: { event: t.event, channel: NotificationChannel.WHATSAPP, bodyTemplate: t.body },
    });
  }
  console.log(`Templates de notification : ${TEMPLATES.length} synchronisés.`);

  const adminPhone = "+22370000001";
  const existingAdmin = await db.user.findUnique({ where: { phoneE164: adminPhone } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        firstName: "Admin",
        lastName: "CHICANO",
        phoneRaw: adminPhone,
        phoneE164: adminPhone,
        passwordHash: await bcrypt.hash("ChangeMe123!", 12),
        role: "SUPER_ADMIN",
        status: "VERIFIED",
        whatsappVerified: true,
        whatsappVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
      },
    });
    console.log(`Compte super admin créé : ${adminPhone} / ChangeMe123! (à changer immédiatement)`);
  } else {
    console.log("Compte super admin déjà présent, aucune modification.");
  }

  // Techniciens de démonstration (Phase 4 — affectation basique). Aucune
  // donnée réelle, comptes clairement identifiés DEMO.
  const demoTechnicians: { phone: string; firstName: string; lastName: string; skills: TechnicianSkill[] }[] = [
    { phone: "+22370000030", firstName: "DEMO", lastName: "TECHNICIEN A", skills: ["MECHANICAL", "DIAGNOSTIC"] },
    { phone: "+22370000031", firstName: "DEMO", lastName: "TECHNICIEN B", skills: ["ELECTRICAL", "ELECTRONICS"] },
  ];

  for (const t of demoTechnicians) {
    const existingUser = await db.user.findUnique({ where: { phoneE164: t.phone } });
    if (existingUser) {
      console.log(`Technicien déjà présent : ${t.phone}, aucune modification.`);
      continue;
    }
    await db.user.create({
      data: {
        firstName: t.firstName,
        lastName: t.lastName,
        phoneRaw: t.phone,
        phoneE164: t.phone,
        passwordHash: await bcrypt.hash("ChangeMe123!", 12),
        role: "TECHNICIAN",
        status: "VERIFIED",
        whatsappVerified: true,
        whatsappVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        technicianProfile: { create: { skills: t.skills } },
      },
    });
    console.log(`Technicien créé : ${t.phone} / ChangeMe123!`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
