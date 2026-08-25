import { NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { listAppointmentsForCustomer } from "@/lib/appointments/service";
import { jsonApiErrorResponse } from "@/lib/http";

// Pas de POST ici : un Appointment naît toujours de
// POST /api/service-requests/[id]/accept (côté production) — voir
// docs/SERVICE-REQUESTS.md.
export async function GET() {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const appointments = await listAppointmentsForCustomer(customerId);
    return NextResponse.json({ appointments });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
