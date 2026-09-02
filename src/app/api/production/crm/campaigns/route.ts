import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireProductionRole, requireAdminRole } from "@/lib/rbac";
import { listCampaigns, createCampaign } from "@/lib/crm/campaigns";
import { jsonApiErrorResponse, jsonFromZodError } from "@/lib/http";
import type { CampaignSegment, CampaignStatus } from "@prisma/client";

const SEGMENTS = new Set(["NEW", "ACTIVE", "RECURRING", "DORMANT", "AT_RISK", "VIP"]);
const STATUSES = new Set(["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "CANCELLED"]);

const schema = z.object({
  name: z.string().min(1).max(255),
  objective: z.enum(["MAINTENANCE", "SEASONAL_CHECK", "BATTERY", "TYRES", "TRAVEL_CHECK", "REACTIVATION", "CARE"]),
  segment: z.enum(["NEW", "ACTIVE", "RECURRING", "DORMANT", "AT_RISK", "VIP"]),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "IN_APP"]),
  message: z.string().min(1).max(2000),
  scheduledAt: z.string().optional(),
});

// Lecture ouverte à la production (visibilité sur les campagnes en cours),
// création réservée à ADMIN/SUPER_ADMIN — le "CRM complet" de la Phase 10
// (pas de rôle Manager distinct dans ce projet).
export async function GET(req: NextRequest) {
  try {
    await requireProductionRole();
    const params = req.nextUrl.searchParams;
    const status = params.get("status");
    const segment = params.get("segment");
    const campaigns = await listCampaigns({
      status: status && STATUSES.has(status) ? (status as CampaignStatus) : undefined,
      segment: segment && SEGMENTS.has(segment) ? (segment as CampaignSegment) : undefined,
    });
    return NextResponse.json(campaigns);
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requireAdminRole();
    const input = schema.parse(await req.json());
    const campaign = await createCampaign(session.sub, input);
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return jsonFromZodError(err);
    return jsonApiErrorResponse(err);
  }
}
