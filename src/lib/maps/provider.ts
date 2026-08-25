// Abstraction cartographique (section "CARTE" de la Phase 3) — même principe
// que MessagingProvider/StorageProvider : ne jamais enfermer l'application
// dans un fournisseur unique. L'implémentation MVP (OpenStreetMapProvider)
// n'ajoute aucune dépendance JS ni clé API ; Mapbox/Google Maps pourront
// implémenter la même interface plus tard sans changer les appelants.
export interface MapProvider {
  readonly name: string;
  /** URL d'aperçu statique intégrable (iframe) centrée sur un point. */
  embedUrl(latitude: number, longitude: number, zoom?: number): string;
  /** Lien "ouvrir dans une appli de cartographie" pour un point donné. */
  externalLinkUrl(latitude: number, longitude: number): string;
}
