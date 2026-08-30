import { NextResponse } from "next/server";
import { requireTechnician } from "@/lib/technicians/guard";
import { listWorkOrdersForTechnician } from "@/lib/work-orders/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const { technicianId } = await requireTechnician();
    const workOrders = await listWorkOrdersForTechnician(technicianId);
    return NextResponse.json({ workOrders });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
