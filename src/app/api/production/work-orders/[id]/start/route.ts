import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { startWorkOrder } from "@/lib/work-orders/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const workOrder = await startWorkOrder(id);
    return NextResponse.json({ workOrder });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
