import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { listMaintenanceOverviewForProduction, type MaintenanceWindow } from "@/lib/maintenance/service";
import { jsonApiErrorResponse } from "@/lib/http";

const WINDOWS = new Set(["today", "7d", "30d", "overdue"]);

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const window = req.nextUrl.searchParams.get("window");
    const overview = await listMaintenanceOverviewForProduction(
      window && WINDOWS.has(window) ? (window as MaintenanceWindow) : undefined
    );
    return NextResponse.json(overview);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
