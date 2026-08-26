import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { upsertDiagnosticCheck } from "@/lib/diagnostics/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const CATEGORIES = [
  "ENGINE",
  "TRANSMISSION",
  "BRAKING",
  "SUSPENSION",
  "STEERING",
  "ELECTRICAL",
  "ELECTRONICS",
  "AIR_CONDITIONING",
  "BATTERY",
  "SAFETY",
] as const;

const RESULTS = ["NORMAL", "TO_MONITOR", "ANOMALY", "CRITICAL", "NOT_CHECKED"] as const;

const schema = z.object({
  category: z.enum(CATEGORIES),
  result: z.enum(RESULTS),
  observation: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ diagnosticId: string }> }) {
  try {
    const { diagnosticId } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const diagnostic = await upsertDiagnosticCheck(technicianId, diagnosticId, input);
    return NextResponse.json({ diagnostic });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
