import type { MapProvider } from "../provider";

// MVP : OpenStreetMap — aucune clé API, aucune dépendance JS lourde (section
// "CARTE" : "NE PAS ajouter une dépendance lourde sans nécessité"). Limite
// assumée pour cette phase : aperçu statique (iframe), pas de marqueur
// déplaçable à la souris — voir docs/SERVICE-REQUESTS.md pour la correction
// manuelle proposée à la place (bascule vers la saisie d'adresse libre).
export class OpenStreetMapProvider implements MapProvider {
  readonly name = "openstreetmap" as const;

  embedUrl(latitude: number, longitude: number, zoom = 15): string {
    const delta = 0.01 / zoom;
    const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join("%2C");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  }

  externalLinkUrl(latitude: number, longitude: number): string {
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  }
}
