import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { technicianReportMissingPart } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  label: z.string().min(1).max(255),
  reference: z.string().max(100).optional(),
  quantity: z.number().int().positive().optional(),
});

// Signale une pièce manquante — crée la pièce (REQUESTED) ET bascule
// automatiquement l'ordre en WAITING_PARTS.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const workOrder = await technicianReportMissingPart(technicianId, id, input);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
