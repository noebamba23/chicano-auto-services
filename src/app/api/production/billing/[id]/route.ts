import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { getInvoiceForProduction, updateInvoiceCharges } from "@/lib/billing/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  discount: z.number().nonnegative().optional(),
  travelFee: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  dueAt: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const invoice = await getInvoiceForProduction(id);
    return NextResponse.json({ invoice });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

// Uniquement tant que DRAFT (assertEditable côté service) — une facture
// ISSUED ne doit jamais être modifiée silencieusement.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const invoice = await updateInvoiceCharges(id, input);
    return NextResponse.json({ invoice });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
