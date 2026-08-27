// Immatriculation malienne — MVP volontairement simplifié à la seule règle de
// format LL CCC LL (2 lettres, 3 chiffres, 2 lettres). Toute donnée
// territoriale (région/arrondissement/cercle) a été explicitement écartée —
// voir docs/VEHICLE-REGISTRATION-MALI.md, section "Version MVP".
//
//   - 2 lettres : série de base
//   - 3 chiffres : numéro d'ordre
//   - 2 lettres : série déroulante

export class InvalidPlateFormatError extends Error {
  constructor() {
    super("Le numéro d'immatriculation doit respecter le format malien LL CCC LL.");
    this.name = "InvalidPlateFormatError";
  }
}

export interface ParsedPlateNumber {
  series: string;
  sequence: number;
  suffix: string;
}

const PLATE_REGEX = /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/;

// Fonction unique de normalisation — utilisée par la création/modification,
// la recherche, et la propagation ServiceRequest/Diagnostic/Quote. Majuscules,
// séparateurs parasites (espaces, tirets, points) retirés.
export function normalizePlateNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-.]/g, "");
}

export function validatePlateNumber(raw: string): boolean {
  return PLATE_REGEX.test(normalizePlateNumber(raw));
}

// Retourne null plutôt que de lever si le format est invalide — laisse
// l'appelant décider (formulaire : afficher une erreur ; recherche : traiter
// comme "aucun résultat" plutôt que de faire échouer la requête).
export function parsePlateNumber(raw: string): ParsedPlateNumber | null {
  const normalized = normalizePlateNumber(raw);
  if (!PLATE_REGEX.test(normalized)) return null;

  return {
    series: normalized.slice(0, 2),
    sequence: Number(normalized.slice(2, 5)),
    suffix: normalized.slice(5, 7),
  };
}

// Reconstruit le numéro normalisé complet à partir des composants
// structurés. Lève si les composants ne reconstruisent pas un format valide
// (garde défensive interne — n'est jamais atteinte pour des composants
// eux-mêmes issus de parsePlateNumber()).
export function buildPlateNumber(parts: ParsedPlateNumber): string {
  const candidate = `${parts.series}${String(parts.sequence).padStart(3, "0")}${parts.suffix}`;
  if (!PLATE_REGEX.test(candidate)) throw new InvalidPlateFormatError();
  return candidate;
}

// Format d'affichage "AB 123 CD". Ne lève jamais : une valeur qui ne
// respecte pas le format (ex. immatriculation héritée LEGACY_NEEDS_REVIEW)
// est affichée telle quelle plutôt que de faire échouer le rendu.
export function formatPlateNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parsePlateNumber(raw);
  if (!parsed) return raw;
  return `${parsed.series} ${String(parsed.sequence).padStart(3, "0")} ${parsed.suffix}`;
}
