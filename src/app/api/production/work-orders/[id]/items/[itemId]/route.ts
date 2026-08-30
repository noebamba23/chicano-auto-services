import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole } from "@/lib/rbac";
import { updateWorkOrderItem } from "@/lib/work-orders/service";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";

const MAINTENANCE_TYPES = [
  "OIL_CHANGE", "OIL_FILTER", "AIR_FILTER", "FUEL_FILTER", "BRAKES", "BRAKE_FLUID", "TIRES", "BATTERY",
  "AIR_CONDITIONING", "TIMING_BELT", "SPARK_PLUGS", "TRANSMISSION", "COOLANT", "TECHNICAL_INSPECTION",
  "PERIODIC_SERVICE", "OTHER",
] as const;

// Statut/minutage réel uniquement — jamais le prix ni la quantité, qui
// proviennent du devis accepté (voir règle "ne pas modifier silencieusement
// le périmètre financier approuvé"). maintenanceType rattache la ligne au
// carnet d'entretien (Phase 8) — voir docs/MAINTENANCE.md.
const schema = z.object({
  status: z.enum(["PENDING", "DONE"]).optional(),
  actualMinutes: z.number().int().nonnegative().optional(),
  technicianId: z.string().optional(),
  maintenanceType: z.enum(MAINTENANCE_TYPES).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await params;
    await requireProductionRole();
    const input = schema.parse(await req.json());
    const workOrder = await updateWorkOrderItem(id, itemId, input);
    return NextResponse.json({ workOrder });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
