import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { listServiceRequestsForProduction, type ProductionFilters } from "@/lib/service-requests/service";
import { jsonApiErrorResponse } from "@/lib/http";
import type { InterventionType, ServiceRequestStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();

    const { searchParams } = new URL(req.url);
    const filters: ProductionFilters = {};

    const status = searchParams.get("status");
    if (status) filters.status = status as ServiceRequestStatus;

    const urgent = searchParams.get("urgent");
    if (urgent === "true") filters.isUrgent = true;

    const mode = searchParams.get("mode");
    if (mode === "AT_GARAGE" || mode === "MOBILE") filters.interventionType = mode as InterventionType;

    const requests = await listServiceRequestsForProduction(filters);
    return NextResponse.json({ requests });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
