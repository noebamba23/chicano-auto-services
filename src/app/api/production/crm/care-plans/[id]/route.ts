import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdminRole } from "@/lib/rbac";
import { updateCarePlan } from "@/lib/crm/care";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().int().positive().optional(),
  durationMonths: z.number().int().positive().optional(),
  frequencyMonths: z.number().int().positive().optional(),
  includedServices: z.array(z.string().min(1)).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole();
    const { id } = await params;
    const input = schema.parse(await req.json());
    const plan = await updateCarePlan(id, input);
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
