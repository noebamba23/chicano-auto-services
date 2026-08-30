import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { initiateClientPayment } from "@/lib/billing/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

// Le client ne peut initier qu'un paiement Mobile Money (CASH/virement
// restent une saisie production, attestant une transaction déjà réalisée en
// personne). Aucun provider n'est réellement connecté dans cette phase —
// initiateClientPayment() ne lance donc jamais de transaction externe
// réelle, voir docs/BILLING.md.
const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["ORANGE_MONEY", "MOOV_MONEY", "WAVE"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const input = schema.parse(await req.json());
    const result = await initiateClientPayment(customerId, id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
