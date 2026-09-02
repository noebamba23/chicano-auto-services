import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { listCustomersForCrm } from "@/lib/crm/directory";
import { jsonApiErrorResponse } from "@/lib/http";
import type { CampaignSegment, CustomerType } from "@prisma/client";

const SEGMENTS = new Set(["NEW", "ACTIVE", "RECURRING", "DORMANT", "AT_RISK", "VIP"]);
const CUSTOMER_TYPES = new Set(["INDIVIDUAL", "PROFESSIONAL", "BUSINESS", "FLEET"]);

export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const params = req.nextUrl.searchParams;
    const segment = params.get("segment");
    const customerType = params.get("customerType");
    const page = Number(params.get("page") ?? "1");

    const result = await listCustomersForCrm({
      segment: segment && SEGMENTS.has(segment) ? (segment as CampaignSegment) : undefined,
      customerType: customerType && CUSTOMER_TYPES.has(customerType) ? (customerType as CustomerType) : undefined,
      search: params.get("search") ?? undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
