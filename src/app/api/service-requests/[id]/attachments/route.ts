import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { addServiceRequestAttachment, getServiceRequestForCustomer } from "@/lib/service-requests/service";
import { getStorageProvider } from "@/lib/storage/get-provider";
import { jsonApiErrorResponse, jsonError } from "@/lib/http";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo (photo ou courte vidéo)
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]);

// Médias facultatifs joints à une demande (section "ÉTAPE 3 — PROBLÈME" de
// la Phase 3) — même StorageProvider que les photos véhicule (Phase 2),
// jamais simulé.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();

    await getServiceRequestForCustomer(customerId, id);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) return jsonError("Aucun fichier reçu.", 422);
    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonError("Format non supporté (JPEG, PNG, WebP ou vidéo MP4/MOV).", 422);
    }
    if (file.size > MAX_SIZE_BYTES) return jsonError("Le fichier dépasse 20 Mo.", 422);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorageProvider();
    const stored = await storage.upload({
      buffer,
      fileName: file.name,
      contentType: file.type,
      folder: `service-requests/${id}`,
    });

    const type = file.type.startsWith("video/") ? "video" : "photo";
    const attachment = await addServiceRequestAttachment(customerId, id, { url: stored.url, type });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
