import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { requestAdditionalWork } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ notes: z.string().min(1).max(2000) });

// Signal léger uniquement — ne modifie jamais le devis accepté (voir
// docs/WORK-ORDERS.md). Un nouveau devis/version reste une action distincte.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await requestAdditionalWork(id, input.notes);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
