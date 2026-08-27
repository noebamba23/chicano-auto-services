import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { sendQuoteToClient } from "@/lib/quotes/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const { quoteId } = await params;
    await requireProductionRole();
    const quote = await sendQuoteToClient(quoteId);
    return NextResponse.json({ quote });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
