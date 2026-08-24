import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { archiveVehicle } from "@/lib/vehicles/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const vehicle = await archiveVehicle(customerId, id);
    return NextResponse.json({ vehicle });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
