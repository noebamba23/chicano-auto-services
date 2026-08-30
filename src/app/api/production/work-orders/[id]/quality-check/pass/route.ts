import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { passQualityCheck } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  notes: z.string().max(2000).optional(),
  testDrivePerformed: z.boolean().optional(),
  testDriveNotes: z.string().max(2000).optional(),
});

// VALIDER — QUALITY_CHECK → COMPLETED. Un Work Order ne peut pas passer à
// COMPLETED sans ce contrôle qualité explicite (voir docs/WORK-ORDERS.md).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireProductionRole();
    const input = schema.parse(await req.json().catch(() => ({})));
    const workOrder = await passQualityCheck(id, session.sub, input);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
