import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { pauseCareSubscription, resumeCareSubscription, cancelCareSubscription } from "@/lib/crm/care";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ action: z.enum(["PAUSE", "RESUME", "CANCEL"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const { action } = schema.parse(await req.json());
    const result =
      action === "PAUSE" ? await pauseCareSubscription(id) : action === "RESUME" ? await resumeCareSubscription(id) : await cancelCareSubscription(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
