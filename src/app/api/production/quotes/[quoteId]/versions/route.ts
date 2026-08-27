import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { createQuoteVersion } from "@/lib/quotes/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const itemSchema = z.object({
  label: z.string().min(1).max(255),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const schema = z.object({
  laborAmount: z.number().nonnegative().optional(),
  travelAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().positive().optional(),
  terms: z.string().max(2000).optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const { quoteId } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const quote = await createQuoteVersion(quoteId, input);
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
