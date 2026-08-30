import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { recordMileageReading } from "@/lib/vehicles/mileage";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ value: z.number().int().nonnegative(), confirmed: z.boolean().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireTechnician();
    const input = schema.parse(await req.json());
    const reading = await recordMileageReading(id, { value: input.value, source: "TECHNICIAN", confirmed: input.confirmed });
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
