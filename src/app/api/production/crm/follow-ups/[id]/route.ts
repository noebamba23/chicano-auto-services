import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { completeFollowUp, cancelFollowUp } from "@/lib/crm/follow-ups";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ action: z.enum(["COMPLETE", "CANCEL"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const { action } = schema.parse(await req.json());
    const result = action === "COMPLETE" ? await completeFollowUp(id) : await cancelFollowUp(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
