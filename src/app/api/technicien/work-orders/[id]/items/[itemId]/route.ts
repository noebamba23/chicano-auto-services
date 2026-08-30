import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { technicianRecordWork } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

// Le technicien renseigne le travail effectué — jamais le prix ni la
// quantité approuvée (voir règle "ne pas modifier silencieusement le
// périmètre financier approuvé").
const schema = z.object({
  status: z.enum(["PENDING", "DONE"]).optional(),
  actualMinutes: z.number().int().nonnegative().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const workOrder = await technicianRecordWork(technicianId, id, itemId, input);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
