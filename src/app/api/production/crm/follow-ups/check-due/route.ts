import { NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { checkAndNotifyDueFollowUps } from "@/lib/crm/follow-ups";
import { jsonApiErrorResponse } from "@/lib/http";

// Déclenchement manuel — aucun scheduler dans ce projet (même limite que
// /api/production/billing/check-overdue, docs/BILLING.md).
export async function POST() {
  try {
    await requireProductionRole();
    const result = await checkAndNotifyDueFollowUps();
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
