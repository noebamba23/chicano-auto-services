import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { createServiceRequestFromReminder } from "@/lib/maintenance/service";
import { jsonApiErrorResponse } from "@/lib/http";

// "PRENDRE RENDEZ-VOUS" — crée une ServiceRequest pré-remplie (véhicule +
// service déjà sélectionnés), jamais un Appointment confirmé directement
// (voir docs/MAINTENANCE.md, section "Rappel → ServiceRequest").
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const serviceRequest = await createServiceRequestFromReminder(customerId, id);
    return NextResponse.json({ serviceRequest }, { status: 201 });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
