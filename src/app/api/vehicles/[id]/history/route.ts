import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { getVehicleHistoryForCustomer, type VehicleHistoryCategory } from "@/lib/vehicles/history";
import { jsonApiErrorResponse } from "@/lib/http";

const CATEGORIES = new Set(["DIAGNOSTIC", "MAINTENANCE", "REPAIR", "TECHNICAL_VISIT", "OTHER"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();

    const category = req.nextUrl.searchParams.get("category");
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");

    const result = await getVehicleHistoryForCustomer(customerId, id, {
      category: category && CATEGORIES.has(category) ? (category as VehicleHistoryCategory) : undefined,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 20,
    });

    return NextResponse.json(result);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
