import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { listWorkOrdersForProduction } from "@/lib/work-orders/service";
import { jsonApiErrorResponse } from "@/lib/http";
import type { WorkOrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const status = req.nextUrl.searchParams.get("status") as WorkOrderStatus | null;
    const workOrders = await listWorkOrdersForProduction({ status: status ?? undefined });
    return NextResponse.json({ workOrders });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
