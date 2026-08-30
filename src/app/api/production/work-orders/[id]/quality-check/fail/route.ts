import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { failQualityCheck } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ notes: z.string().min(1).max(2000) });

// Contrôle qualité échoué — QUALITY_CHECK → IN_PROGRESS (renvoyé en travaux).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await failQualityCheck(id, session.sub, input.notes);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
