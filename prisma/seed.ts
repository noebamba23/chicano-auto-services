import { PrismaClient, NotificationEvent, NotificationChannel } from "@prisma/client";
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
