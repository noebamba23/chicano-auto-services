import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { StorageProvider, StoredFile } from "../provider";

const PUBLIC_DIR = path.join(process.cwd(), "public", "uploads");

// Fournisseur de développement : écrit réellement le fichier sur disque sous
// public/uploads et le sert via les fichiers statiques Next.js. Ce n'est PAS
// une simulation — le fichier existe et l'URL fonctionne — mais ce n'est pas
// un backend adapté à un déploiement multi-instance/production (pas de CDN,
// pas de durabilité garantie). Section 11 : à remplacer en production par un
// StorageProvider objet (S3, Cloudinary, Supabase Storage...) implémentant la
// même interface — voir docs/VEHICLES.md.
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local-disk" as const;

  async upload(params: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    folder: string;
  }): Promise<StoredFile> {
    const ext = path.extname(params.fileName) || guessExtension(params.contentType);
    const key = `${params.folder}/${randomUUID()}${ext}`;
    const absoluteDir = path.join(PUBLIC_DIR, params.folder);
    const absolutePath = path.join(PUBLIC_DIR, key);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(absolutePath, params.buffer);

    return { url: `/uploads/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(path.join(PUBLIC_DIR, key));
    } catch {
      // fichier déjà absent — rien à faire
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
    default:
      return ".jpg";
  }
}
