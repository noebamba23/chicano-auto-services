import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { requestReschedule } from "@/lib/service-requests/service";
import { rescheduleServiceRequestSchema } from "@/lib/validation/service-requests";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = rescheduleServiceRequestSchema.parse(await req.json());
    const request = await requestReschedule(id, input);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
