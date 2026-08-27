import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { publishReport } from "@/lib/reports/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    const { session } = await requireProductionRole();
    const report = await publishReport(reportId, session.sub);
    return NextResponse.json({ report });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
