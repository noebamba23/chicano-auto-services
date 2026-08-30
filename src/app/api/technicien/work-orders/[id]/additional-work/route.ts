import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireTechnician } from "@/lib/technicians/guard";
import { technicianRequestAdditionalWork } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ notes: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { technicianId } = await requireTechnician();
    const input = schema.parse(await req.json());
    const workOrder = await technicianRequestAdditionalWork(technicianId, id, input.notes);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
