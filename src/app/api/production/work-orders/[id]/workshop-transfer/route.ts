import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { requestWorkshopTransfer } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  reason: z.string().min(1).max(1000),
  vehicleCondition: z.string().max(1000).optional(),
  destination: z.string().max(255).optional(),
});

// Intervention mobile où la réparation s'avère impossible sur place —
// embarquement garage (voir docs/WORK-ORDERS.md, section "Mobile"). Ne
// supprime jamais l'Appointment initial.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await requestWorkshopTransfer(id, { ...input, transferredById: session.sub });
    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
