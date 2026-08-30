import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { recordMileageReading } from "@/lib/vehicles/mileage";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

// La production peut corriger une régression (ex. erreur de saisie
// antérieure) mais seulement de façon explicite (confirmed), jamais
// silencieusement — voir docs/MAINTENANCE.md.
const schema = z.object({ value: z.number().int().nonnegative(), confirmed: z.boolean().optional(), notes: z.string().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const reading = await recordMileageReading(id, { value: input.value, source: "SYSTEM", confirmed: input.confirmed, notes: input.notes });
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
