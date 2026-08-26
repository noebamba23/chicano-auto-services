import { NextRequest, NextResponse } from "next/server";
import { requireTechnician } from "@/lib/technicians/guard";
import { removeFaultCode } from "@/lib/diagnostics/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ diagnosticId: string; faultCodeId: string }> }
) {
  try {
    const { diagnosticId, faultCodeId } = await params;
    const { technicianId } = await requireTechnician();
    const diagnostic = await removeFaultCode(technicianId, diagnosticId, faultCodeId);
    return NextResponse.json({ diagnostic });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
