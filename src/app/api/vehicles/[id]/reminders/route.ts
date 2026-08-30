import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { getVehicleMaintenanceForCustomer } from "@/lib/maintenance/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const { reminders } = await getVehicleMaintenanceForCustomer(customerId, id);
    return NextResponse.json({ reminders });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
