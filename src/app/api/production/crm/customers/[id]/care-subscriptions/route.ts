import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { createCareSubscription, listCareSubscriptionsForCustomer } from "@/lib/crm/care";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  carePlanId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const subscriptions = await listCareSubscriptionsForCustomer(id);
    return NextResponse.json(subscriptions);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

// Production propose/active un plan pour un client — pas d'auto-
// souscription client dans cette phase (aucun paiement récurrent
// automatique, voir docs/CHICANO-CARE.md).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const input = schema.parse(await req.json());
    const subscription = await createCareSubscription({ customerId: id, ...input });
    return NextResponse.json(subscription, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
