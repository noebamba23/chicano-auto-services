import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { markUnderReview } from "@/lib/service-requests/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const request = await markUnderReview(id);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
