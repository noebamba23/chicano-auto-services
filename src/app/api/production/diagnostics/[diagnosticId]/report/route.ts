import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { getOrCreateDraftReport } from "@/lib/reports/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ diagnosticId: string }> }) {
  try {
    const { diagnosticId } = await params;
    await requireProductionRole();
    const report = await getOrCreateDraftReport(diagnosticId);
    return NextResponse.json({ report });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
