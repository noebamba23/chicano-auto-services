import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { rejectServiceRequest } from "@/lib/service-requests/service";
import { rejectServiceRequestSchema } from "@/lib/validation/service-requests";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = rejectServiceRequestSchema.parse(await req.json());
    const request = await rejectServiceRequest(id, input.reason);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
