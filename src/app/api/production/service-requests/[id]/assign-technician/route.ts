import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { assignTechnician } from "@/lib/technicians/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";
import { ZodError } from "zod";

const schema = z.object({ technicianId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const assignment = await assignTechnician(id, input.technicianId);
    return NextResponse.json({ assignment });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
