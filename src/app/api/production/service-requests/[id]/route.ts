import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { getServiceRequestForProduction } from "@/lib/service-requests/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const request = await getServiceRequestForProduction(id);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
