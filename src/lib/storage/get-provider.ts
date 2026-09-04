import type { StorageProvider } from "./provider";
import { LocalStorageProvider } from "./providers/local-storage-provider";
import { VercelBlobStorageProvider } from "./providers/vercel-blob-storage-provider";

let cached: StorageProvider | null = null;

// Sélectionne le backend de stockage actif. "local" (par défaut, dev
// uniquement) écrit réellement sur disque sous public/uploads — incompatible
// avec un déploiement serverless (filesystem éphémère). "vercel-blob"
// (production) persiste réellement les fichiers via Vercel Blob, requiert
// BLOB_READ_WRITE_TOKEN (provisionné automatiquement par Vercel dès qu'un
// store Blob est attaché au projet).
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const mode = process.env.STORAGE_PROVIDER_MODE ?? "local";

  if (mode === "local") {
    cached = new LocalStorageProvider();
    return cached;
  }

  if (mode === "vercel-blob") {
    cached = new VercelBlobStorageProvider();
    return cached;
  }

  throw new Error(
    `STORAGE_PROVIDER_MODE="${mode}" n'est pas reconnu. Valeurs supportées : "local", "vercel-blob".`
  );
}
