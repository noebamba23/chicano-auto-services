import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { addWorkOrderPart } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  label: z.string().min(1).max(255),
  reference: z.string().max(100).optional(),
  quantity: z.number().int().positive().optional(),
  partId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await addWorkOrderPart(id, input);
    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
