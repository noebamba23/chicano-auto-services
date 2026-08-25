import { NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { listTechnicians } from "@/lib/technicians/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireProductionRole();
    const technicians = await listTechnicians();
    return NextResponse.json({ technicians });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
