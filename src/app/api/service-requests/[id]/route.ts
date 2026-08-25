import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { getServiceRequestForCustomer, ServiceRequestConflictError } from "@/lib/service-requests/service";
import { db } from "@/lib/db";
import { jsonApiErrorResponse } from "@/lib/http";

const patchSchema = z.object({
  description: z.string().trim().min(1).max(2000).optional(),
  urgencyDescription: z.string().trim().max(1000).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const request = await getServiceRequestForCustomer(customerId, id);
    return NextResponse.json({ request });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

// Édition volontairement restreinte : seul le contenu descriptif peut être
// corrigé, et uniquement tant que la demande n'est pas encore passée en
// examen (SUBMITTED) — jamais le statut, jamais après UNDER_REVIEW. Les
// transitions de statut passent exclusivement par les routes dédiées
// (cancel/accept/reject/reschedule), jamais par ce PATCH générique.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();
    const input = patchSchema.parse(await req.json());

    const existing = await getServiceRequestForCustomer(customerId, id);
    if (existing.status !== "SUBMITTED") {
      throw new ServiceRequestConflictError(
        "Cette demande est déjà en cours d'examen ou traitée — elle ne peut plus être modifiée directement."
      );
    }

    const updated = await db.serviceRequest.update({
      where: { id },
      data: input,
    });

    return NextResponse.json({ request: updated });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
