import { db } from "@/lib/db";
import { ServiceRequestNotFoundError } from "@/lib/service-requests/service";

// Lecture seule côté client — un Appointment naît toujours comme effet de
// bord de ServiceRequest.accept (src/lib/service-requests/service.ts), il
// n'existe pas de création directe exposée publiquement (voir
// docs/SERVICE-REQUESTS.md, section "Pourquoi pas de POST /api/appointments").

const APPOINTMENT_INCLUDE = {
  vehicle: true,
  location: true,
  serviceRequest: { select: { referenceNumber: true, category: true } },
} as const;

export function listAppointmentsForCustomer(customerId: string) {
  return db.appointment.findMany({
    where: { customerId },
    include: APPOINTMENT_INCLUDE,
    orderBy: { scheduledDate: "asc" },
  });
}

export async function getAppointmentForCustomer(customerId: string, id: string) {
  const appointment = await db.appointment.findFirst({
    where: { id, customerId },
    include: APPOINTMENT_INCLUDE,
  });
  // Même règle que pour les véhicules (section 6 Phase 2) : un rendez-vous
  // d'un autre client se comporte comme un rendez-vous inexistant.
  if (!appointment) throw new ServiceRequestNotFoundError();
  return appointment;
}
