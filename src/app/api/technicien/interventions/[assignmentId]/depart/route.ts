import { NextRequest, NextResponse } from "next/server";
import { requireTechnician } from "@/lib/technicians/guard";
import { departForAssignment } from "@/lib/technicians/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params;
    const { technicianId } = await requireTechnician();
    const assignment = await departForAssignment(technicianId, assignmentId);
    return NextResponse.json({ assignment });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
