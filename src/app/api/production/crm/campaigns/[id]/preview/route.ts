import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/rbac";
import { previewCampaign } from "@/lib/crm/campaigns";
import { jsonApiErrorResponse } from "@/lib/http";

// Mode PREVIEW — obligatoire avant tout envoi (voir src/lib/crm/campaigns.ts).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole();
    const { id } = await params;
    const preview = await previewCampaign(id);
    return NextResponse.json(preview);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
