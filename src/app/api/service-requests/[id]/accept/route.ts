import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { acceptServiceRequest } from "@/lib/service-requests/service";
import { acceptServiceRequestSchema } from "@/lib/validation/service-requests";
import { jsonApiErrorResponse } from "@/lib/http";

// Réservée à l'équipe CHICANO (PRODUCTION_STAFF/ADMIN/SUPER_ADMIN) — un
// client ne doit jamais pouvoir appeler cette action, même sur sa propre
// demande (section "PRODUCTION ACCESS" de la Phase 3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProductionRole();
    const input = acceptServiceRequestSchema.parse(await req.json());
    const request = await acceptServiceRequest(id, input);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
