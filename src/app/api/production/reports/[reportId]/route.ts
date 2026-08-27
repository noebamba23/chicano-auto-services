import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { updateReportDraft } from "@/lib/reports/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  conclusion: z.string().max(4000).optional(),
  severity: z.enum(["URGENT", "UPCOMING", "TO_MONITOR", "NORMAL"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const report = await updateReportDraft(reportId, input);
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
