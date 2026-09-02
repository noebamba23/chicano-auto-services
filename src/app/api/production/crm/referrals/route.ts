import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { createReferral, listReferralsForCustomer } from "@/lib/crm/referrals";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const schema = z.object({ referrerCustomerId: z.string().min(1), referredCustomerId: z.string().min(1) });

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const customerId = req.nextUrl.searchParams.get("customerId");
    if (!customerId) return NextResponse.json([]);
    const referrals = await listReferralsForCustomer(customerId);
    return NextResponse.json(referrals);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const referral = await createReferral(input);
    return NextResponse.json(referral, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
