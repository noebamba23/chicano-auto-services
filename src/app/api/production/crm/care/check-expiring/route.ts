import { NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { checkExpiringCareSubscriptions } from "@/lib/crm/care";
import { jsonApiErrorResponse } from "@/lib/http";

// Déclenchement manuel — aucun scheduler dans ce projet.
export async function POST() {
  try {
    await requireProductionRole();
    const result = await checkExpiringCareSubscriptions();
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
