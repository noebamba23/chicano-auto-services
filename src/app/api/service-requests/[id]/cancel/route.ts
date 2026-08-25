import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { cancelServiceRequest } from "@/lib/service-requests/service";
import { jsonApiErrorResponse } from "@/lib/http";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const request = await cancelServiceRequest(customerId, id);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
