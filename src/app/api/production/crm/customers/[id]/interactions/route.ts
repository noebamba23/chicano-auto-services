import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { logInteraction, listInteractionsForCustomer } from "@/lib/crm/interactions";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({
  type: z.enum(["CALL", "WHATSAPP", "EMAIL", "SMS", "NOTE", "APPOINTMENT", "FOLLOW_UP"]),
  subject: z.string().max(255).optional(),
  content: z.string().max(4000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireProductionRole();
    const { id } = await params;
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const result = await listInteractionsForCustomer(id, Number.isFinite(page) && page > 0 ? page : 1);
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await requireProductionRole();
    const { id } = await params;
    const input = schema.parse(await req.json());
    const interaction = await logInteraction(id, session.sub, input);
    return NextResponse.json(interaction, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
