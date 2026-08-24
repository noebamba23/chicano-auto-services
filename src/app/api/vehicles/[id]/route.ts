import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { getVehicleForCustomer, updateVehicle } from "@/lib/vehicles/service";
import { vehicleUpdateSchema } from "@/lib/validation/vehicles";
import { jsonApiErrorResponse } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const vehicle = await getVehicleForCustomer(customerId, id);
    return NextResponse.json({ vehicle });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const input = vehicleUpdateSchema.parse(await req.json());
    const vehicle = await updateVehicle(customerId, id, input);
    return NextResponse.json({ vehicle });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
