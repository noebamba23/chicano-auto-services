import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { createServiceRequest, listServiceRequestsForCustomer } from "@/lib/service-requests/service";
import { createServiceRequestSchema } from "@/lib/validation/service-requests";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const requests = await listServiceRequestsForCustomer(customerId);
    return NextResponse.json({ requests });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const input = createServiceRequestSchema.parse(await req.json());
    const request = await createServiceRequest(customerId, input);
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
