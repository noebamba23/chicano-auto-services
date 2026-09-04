import { put, del } from "@vercel/blob";
import { randomUUID } from "crypto";
import path from "path";
import type { StorageProvider, StoredFile } from "../provider";

// Fournisseur de production (levée du blocker infrastructure "storage
// persistant") — même interface StorageProvider que le fournisseur local
// (Phase 2), aucun appelant n'a besoin de changer. Choisi parmi
// Vercel Blob / Cloudinary / Supabase Storage / S3-compatible pour son
// impact architectural minimal : une seule dépendance (@vercel/blob), un
// seul token (BLOB_READ_WRITE_TOKEN, provisionné automatiquement par
// Vercel dès qu'un store Blob est attaché au projet), aucune configuration
// de bucket/CORS/ACL à maintenir. `key` reste le pathname du blob — c'est
// ce qui est déjà persisté en base (VehiclePhoto.storageKey,
// WorkOrderPhoto.storageKey) et réutilisable tel quel pour `delete()`.
export class VercelBlobStorageProvider implements StorageProvider {
  readonly name = "vercel-blob" as const;

  async upload(params: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    folder: string;
  }): Promise<StoredFile> {
    const ext = path.extname(params.fileName) || guessExtension(params.contentType);
    const pathname = `${params.folder}/${randomUUID()}${ext}`;

    const blob = await put(pathname, params.buffer, {
      access: "public",
      contentType: params.contentType,
      addRandomSuffix: false,
    });

    return { url: blob.url, key: blob.pathname };
  }

  async delete(key: string): Promise<void> {
    try {
      await del(key);
    } catch {
      // fichier déjà absent — même comportement que LocalStorageProvider,
      // une suppression n'échoue jamais silencieusement sur un état déjà
      // atteint.
    }
  }
}

function guessExtension(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "video/mp4":
      return ".mp4";
    case "video/quicktime":
      return ".mov";
    default:
      return ".jpg";
  }
}
