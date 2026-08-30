import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { recordMileageReadingForCustomer } from "@/lib/vehicles/mileage";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ value: z.number().int().nonnegative() });

// Le client ne peut jamais forcer une régression du kilométrage — aucun
// champ "confirmed" exposé ici (voir src/lib/vehicles/mileage.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const input = schema.parse(await req.json());
    const reading = await recordMileageReadingForCustomer(customerId, id, input.value);
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
