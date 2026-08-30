import { NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { markOverdueInvoices } from "@/lib/billing/service";
import { jsonApiErrorResponse } from "@/lib/http";

// Déclenchement manuel (aucun scheduler/cron dans ce projet, même limite que
// docs/MAINTENANCE.md).
export async function POST() {
  try {
    await requireProductionRole();
    const result = await markOverdueInvoices();
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
