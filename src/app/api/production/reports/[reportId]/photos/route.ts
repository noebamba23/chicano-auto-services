import { NextRequest, NextResponse } from "next/server";
import { requireProductionRole } from "@/lib/rbac";
import { addReportPhoto } from "@/lib/reports/service";
import { getStorageProvider } from "@/lib/storage/get-provider";
import { jsonApiErrorResponse, jsonError } from "@/lib/http";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    await requireProductionRole();

    const formData = await req.formData();
    const file = formData.get("photo");
    const caption = formData.get("caption");

    if (!(file instanceof File)) {
      return jsonError("Aucun fichier reçu.", 422);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonError("Format d'image non supporté (JPEG, PNG ou WebP uniquement).", 422);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return jsonError("L'image dépasse la taille maximale autorisée (8 Mo).", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorageProvider();
    const stored = await storage.upload({
      buffer,
      fileName: file.name,
      contentType: file.type,
      folder: `reports/${reportId}`,
    });

    const report = await addReportPhoto(reportId, {
      url: stored.url,
      caption: typeof caption === "string" ? caption : undefined,
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
