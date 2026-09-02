import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { getCustomer360 } from "@/lib/crm/customer360";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const view = await getCustomer360(id);
    return NextResponse.json(view);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
