import { NextRequest, NextResponse } from "next/server";
import { requireTechnician } from "@/lib/technicians/guard";
import { technicianSendToQualityCheck } from "@/lib/work-orders/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { technicianId } = await requireTechnician();
    const workOrder = await technicianSendToQualityCheck(technicianId, id);
    return NextResponse.json({ workOrder });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
