import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { listInvoicesForProduction } from "@/lib/billing/service";
import { jsonApiErrorResponse } from "@/lib/http";
import type { InvoiceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const status = req.nextUrl.searchParams.get("status") as InvoiceStatus | null;
    const invoices = await listInvoicesForProduction({ status: status ?? undefined });
    return NextResponse.json({ invoices });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
