import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { requestQuoteModification } from "@/lib/quotes/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ note: z.string().max(1000).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const { quoteId } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const input = schema.parse(await req.json());
    const quote = await requestQuoteModification(customerId, quoteId, input.note);
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
