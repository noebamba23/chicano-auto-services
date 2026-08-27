import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { removeReportPhoto } from "@/lib/reports/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string; photoId: string }> }
) {
  try {
    const { reportId, photoId } = await params;
    await requireProductionRole();
    const report = await removeReportPhoto(reportId, photoId);
    return NextResponse.json({ report });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
