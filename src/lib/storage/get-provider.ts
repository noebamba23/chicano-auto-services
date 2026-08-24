import type { StorageProvider } from "./provider";
import { LocalStorageProvider } from "./providers/local-storage-provider";

let cached: StorageProvider | null = null;

// Sélectionne le backend de stockage actif. "local" (par défaut) écrit
// réellement sur disque en développement. Un futur mode "s3" (ou équivalent)
// devra être configuré avant tout déploiement multi-instance — voir
// docs/VEHICLES.md pour ce qui reste à connecter.
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const mode = process.env.STORAGE_PROVIDER_MODE ?? "local";

  if (mode === "local") {
    cached = new LocalStorageProvider();
    return cached;
  }

  throw new Error(
    `STORAGE_PROVIDER_MODE="${mode}" n'est pas encore implémenté. Seul "local" est disponible pour le moment.`
  );
}
