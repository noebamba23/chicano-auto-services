import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { addFaultCode } from "@/lib/diagnostics/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  code: z.string().min(1).max(50),
  device: z.string().max(120).optional(),
  deviceBrand: z.string().max(120).optional(),
  deviceModel: z.string().max(120).optional(),
  system: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  measurement: z.string().max(255).optional(),
  observation: z.string().max(2000).optional(),
  recommendation: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ diagnosticId: string }> }) {
  try {
    const { diagnosticId } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const diagnostic = await addFaultCode(technicianId, diagnosticId, input);
    return NextResponse.json({ diagnostic });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
