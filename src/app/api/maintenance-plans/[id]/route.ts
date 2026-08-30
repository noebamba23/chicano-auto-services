import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { updateMaintenancePlan } from "@/lib/maintenance/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  intervalKm: z.number().int().positive().nullable().optional(),
  intervalMonths: z.number().int().positive().nullable().optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const plan = await updateMaintenancePlan(id, input);
    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
