import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { completeDiagnostic } from "@/lib/diagnostics/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  mileageAtVisit: z.number().int().nonnegative().optional(),
  symptoms: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ diagnosticId: string }> }) {
  try {
    const { diagnosticId } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const diagnostic = await completeDiagnostic(technicianId, diagnosticId, input);
    return NextResponse.json({ diagnostic });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
