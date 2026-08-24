import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { createVehicle, listVehiclesForCustomer } from "@/lib/vehicles/service";
import { vehicleInputSchema } from "@/lib/validation/vehicles";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const vehicles = await listVehiclesForCustomer(customerId);
    return NextResponse.json({ vehicles });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await requireVerifiedCustomer();
    const input = vehicleInputSchema.parse(await req.json());
    const vehicle = await createVehicle(customerId, input);
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
