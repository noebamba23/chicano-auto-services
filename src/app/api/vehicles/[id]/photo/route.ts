import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCustomer } from "@/lib/vehicles/guard";
import { addVehiclePhoto, getVehicleForCustomer } from "@/lib/vehicles/service";
import { getStorageProvider } from "@/lib/storage/get-provider";
import { jsonApiErrorResponse, jsonError } from "@/lib/http";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { customerId } = await requireVerifiedCustomer();

    // Vérifie la propriété avant tout traitement du fichier.
    await getVehicleForCustomer(customerId, id);

    const formData = await req.formData();
    const file = formData.get("photo");

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
      folder: `vehicles/${id}`,
    });

    const photo = await addVehiclePhoto(customerId, id, { url: stored.url, storageKey: stored.key });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    return jsonApiErrorResponse(err);
  }
}
