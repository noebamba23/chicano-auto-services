import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { acceptQuote } from "@/lib/quotes/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const { quoteId } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const quote = await acceptQuote(customerId, quoteId);
    return NextResponse.json({ quote });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
