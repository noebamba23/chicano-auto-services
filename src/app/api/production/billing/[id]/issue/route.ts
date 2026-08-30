import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { issueInvoice } from "@/lib/billing/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const invoice = await issueInvoice(id);
    return NextResponse.json({ invoice });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
