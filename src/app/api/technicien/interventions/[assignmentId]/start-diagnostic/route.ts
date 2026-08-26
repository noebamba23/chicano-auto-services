import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { startDiagnostic } from "@/lib/diagnostics/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  mileageAtVisit: z.number().int().nonnegative().optional(),
  symptoms: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const diagnostic = await startDiagnostic(technicianId, assignmentId, input);
    return NextResponse.json({ diagnostic });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
