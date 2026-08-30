import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { sendToQualityCheck } from "@/lib/work-orders/service";
import { jsonApiErrorResponse } from "@/lib/http";

// ENVOYER AU CONTRÔLE — IN_PROGRESS → QUALITY_CHECK.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const workOrder = await sendToQualityCheck(id);
    return NextResponse.json({ workOrder });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
