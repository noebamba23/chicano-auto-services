import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { createFollowUp, listFollowUpsForProduction } from "@/lib/crm/follow-ups";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";
import type { FollowUpStatus } from "@prisma/client";

const STATUSES = new Set(["PENDING", "DONE", "CANCELLED"]);

const schema = z.object({
  customerId: z.string().min(1),
  reason: z.string().min(1).max(500),
  dueAt: z.string().min(1),
  notes: z.string().max(2000).optional(),
  assignedToId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const status = req.nextUrl.searchParams.get("status");
    const followUps = await listFollowUpsForProduction({
      status: status && STATUSES.has(status) ? (status as FollowUpStatus) : undefined,
    });
    return NextResponse.json(followUps);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requireProductionRole();
    const input = schema.parse(await req.json());
    const followUp = await createFollowUp(session.sub, input);
    return NextResponse.json(followUp, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
