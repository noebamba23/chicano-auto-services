import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { updateConsent } from "@/lib/crm/consent";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  whatsappOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

// Consentement recueilli par la production (ex. par téléphone) — jamais un
// texte libre pour consentSource, toujours "PRODUCTION_STAFF" (voir
// src/lib/crm/consent.ts).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const input = schema.parse(await req.json());
    const updated = await updateConsent(id, input, "PRODUCTION_STAFF");
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
