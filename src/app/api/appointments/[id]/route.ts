import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { getAppointmentForCustomer } from "@/lib/appointments/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const appointment = await getAppointmentForCustomer(customerId, id);
    return NextResponse.json({ appointment });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
