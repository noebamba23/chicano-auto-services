import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { updateWorkOrderPartStatus } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  status: z.enum(["REQUESTED", "AVAILABLE", "ORDERED", "RECEIVED", "INSTALLED", "NOT_REQUIRED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; partId: string }> }) {
  try {
    const { id, partId } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await updateWorkOrderPartStatus(id, partId, input.status);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
