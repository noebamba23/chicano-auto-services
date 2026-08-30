import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { assignTechnicianToWorkOrder } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ technicianId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await assignTechnicianToWorkOrder(id, input.technicianId);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
