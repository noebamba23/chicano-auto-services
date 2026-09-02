import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole, requireAdminRole } from "@/lib/rbac";
import { listCarePlans, createCarePlan } from "@/lib/crm/care";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price: z.number().int().positive(),
  durationMonths: z.number().int().positive(),
  frequencyMonths: z.number().int().positive(),
  includedServices: z.array(z.string().min(1)).default([]),
});

// Lecture ouverte à toute la production (catalogue), création réservée à
// ADMIN/SUPER_ADMIN (pas de rôle Manager distinct — voir src/lib/rbac.ts).
export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    const plans = await listCarePlans(includeInactive);
    return NextResponse.json(plans);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole();
    const input = schema.parse(await req.json());
    const plan = await createCarePlan(input);
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
