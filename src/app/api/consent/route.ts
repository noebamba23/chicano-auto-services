import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { getConsent, updateConsent } from "@/lib/crm/consent";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  whatsappOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

// Le client gère lui-même ses préférences de communication — auto-service,
// jamais une action production ici (voir /api/production/crm/customers/
// [id]/consent pour l'équivalent recueilli par la production).
export async function GET() {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const consent = await getConsent(customerId);
    return NextResponse.json(consent);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const input = schema.parse(await req.json());
    const updated = await updateConsent(customerId, input, "CLIENT_PORTAL");
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
