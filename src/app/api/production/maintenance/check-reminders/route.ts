import { NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { checkAndNotifyReminders } from "@/lib/maintenance/service";
import { jsonApiErrorResponse } from "@/lib/http";

// Déclenchement manuel (aucun scheduler/cron dans ce projet — voir
// docs/MAINTENANCE.md, limite assumée) : calcule le niveau de chaque rappel
// actif et notifie en cas de progression (jamais deux fois le même palier).
export async function POST() {
  try {
    await requireProductionRole();
    const result = await checkAndNotifyReminders();
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
