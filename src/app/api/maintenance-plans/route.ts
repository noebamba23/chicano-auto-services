import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { createMaintenancePlan } from "@/lib/maintenance/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const MAINTENANCE_TYPES = [
  "OIL_CHANGE", "OIL_FILTER", "AIR_FILTER", "FUEL_FILTER", "BRAKES", "BRAKE_FLUID", "TIRES", "BATTERY",
  "AIR_CONDITIONING", "TIMING_BELT", "SPARK_PLUGS", "TRANSMISSION", "COOLANT", "TECHNICAL_INSPECTION",
  "PERIODIC_SERVICE", "OTHER",
] as const;

const schema = z.object({
  vehicleId: z.string().min(1),
  type: z.enum(MAINTENANCE_TYPES),
  intervalKm: z.number().int().positive().optional(),
  intervalMonths: z.number().int().positive().optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const plan = await createMaintenancePlan(input.vehicleId, input);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
