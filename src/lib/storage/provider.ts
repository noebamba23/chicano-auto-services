// Abstraction de stockage de fichiers (section 11 de la Phase 2), sur le même
// principe que MessagingProvider (src/lib/messaging) : ne jamais enfermer le
// code dans un backend unique, ni simuler une URL qui ne sert réellement rien.

export interface StoredFile {
  url: string;
  key: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(params: { buffer: Buffer; fileName: string; contentType: string; folder: string }): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}
