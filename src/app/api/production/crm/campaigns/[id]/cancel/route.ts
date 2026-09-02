import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/rbac";
import { cancelCampaign } from "@/lib/crm/campaigns";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole();
    const { id } = await params;
    const result = await cancelCampaign(id);
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
