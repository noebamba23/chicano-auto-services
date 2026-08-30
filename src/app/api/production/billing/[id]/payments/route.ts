import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { recordPayment } from "@/lib/billing/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "ORANGE_MONEY", "MOOV_MONEY", "WAVE", "BANK_TRANSFER", "OTHER"]),
  externalReference: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
});

// Production peut enregistrer n'importe quelle méthode (attestation directe
// pour CASH/BANK_TRANSFER/OTHER) — contrairement au client, limité à Mobile
// Money via /api/invoices/[id]/pay (voir docs/BILLING.md).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const result = await recordPayment(id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
