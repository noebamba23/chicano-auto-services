# Immatriculation malienne — évolution du modèle Vehicle

**Version MVP : validation du format LL CCC LL uniquement.**

Cette évolution avait initialement introduit une modélisation territoriale
complète (région, arrondissement de Bamako, cercle des autres régions, table
de référence `MaliAdministrativeArea`). Sur demande explicite, ce périmètre a
été **volontairement retiré** (migration
`20260827090000_vehicle_registration_mvp_simplify`) pour ne pas bloquer le
MVP sur une nomenclature administrative non vérifiée. **Aucune donnée
territoriale n'est implémentée dans cette version** — ni modèle, ni champ, ni
UI. Si ce périmètre revient un jour, il faudra une source officielle vérifiée
avant de le réintroduire (voir l'historique git pour la version antérieure
de cette évolution, retirée proprement).

## Modèle de données

`Vehicle` reste simple :

- `licensePlate` (`String? @unique`) — chaîne normalisée affichée/recherchée
  par défaut (ex. `"AB123CD"`).
- `plateDataStatus` (`STRUCTURED` | `LEGACY_NEEDS_REVIEW`) — `STRUCTURED` si
  la valeur a été validée contre le format LL CCC LL ; `LEGACY_NEEDS_REVIEW`
  pour toute donnée antérieure à l'introduction de cette validation (aucune
  perte, aucune donnée inventée pour la reclasser).

Aucun autre champ. Pas de table de référence géographique.

## Format

Une immatriculation malienne de véhicule particulier :

```
LL CCC LL
```

2 lettres (série de base) + 3 chiffres (numéro d'ordre) + 2 lettres (série
déroulante). Exemple : `AB123CD`. Affiché : `AB 123 CD`.

## Validation et normalisation (`src/lib/vehicles/registration/plate.ts`)

- `normalizePlateNumber(raw)` — fonction unique de normalisation (majuscules,
  espaces/tirets/points retirés), utilisée partout (création, modification,
  recherche, propagation ServiceRequest/Diagnostic/Quote, affichage) : jamais
  dupliquée ailleurs.
- `validatePlateNumber(raw)` — normalise puis teste contre
  `^[A-Z]{2}[0-9]{3}[A-Z]{2}$`.
- `parsePlateNumber(raw)` — décompose en `{ series, sequence, suffix }` ou
  `null` si invalide (ne lève jamais).
- `buildPlateNumber(parts)` — reconstruit la chaîne normalisée depuis les
  composants (garde défensive interne, lève `InvalidPlateFormatError` si les
  composants ne reconstruisent pas un format valide).
- `formatPlateNumber(raw)` — affichage `"AB 123 CD"` ; ne lève jamais : une
  valeur héritée non conforme est affichée telle quelle.

## UI

Le formulaire véhicule ne demande qu'un champ **Immatriculation**, saisie
libre tolérante aux espaces/à la casse (`AB123CD`, `AB 123 CD`, `ab123cd`),
avec l'aide *"Format : LL CCC LL"* et un aperçu normalisé en temps réel. La
validation finale reste stricte (message d'erreur explicite si le format
n'est pas respecté). Aucune sélection région/zone.

## Recherche

`findVehiclesByPlateForProduction()` normalise la requête avant de comparer —
`AB123CD`, `AB 123 CD` et `ab123cd` retrouvent le même véhicule.

## Propagation (ServiceRequest / Diagnostic / Quote)

`ServiceRequest.vehicle`, `Diagnostic.vehicle`, `DiagnosticReport.diagnostic.vehicle`
et `Quote.vehicle` exposent `licensePlate` — jamais ressaisi. Cette
simplification ne bloque ni le versioning des devis, ni le rapport de
diagnostic, ni aucune fonctionnalité de la Phase 5/6 : le véhicule fournit
simplement sa plaque normalisée.

## Migrations

1. `20260827080000_vehicle_registration_mali` — introduction initiale
   (territoriale, depuis retirée).
2. `20260827090000_vehicle_registration_mvp_simplify` — retrait complet de la
   modélisation territoriale (colonnes `plateSeries`/`plateSequence`/
   `plateSeriesSuffix`/`registrationAreaType`/`registrationAreaId`/
   `registrationCountryCode`, table `MaliAdministrativeArea`, enum
   `RegistrationAreaType`). Additive/destructive uniquement sur des colonnes
   et une table qui n'avaient jamais été peuplées de données réelles (la
   table de référence était volontairement vide) — `licensePlate` lui-même
   n'a jamais été touché, aucune perte de donnée.

`prisma migrate dev` refusant l'environnement non interactif (déjà rencontré
en Phase 3/6), les deux migrations ont été écrites à la main puis appliquées
via `prisma migrate deploy`.

## Non couvert (volontairement, MVP)

- Toute donnée territoriale (région, arrondissement, cercle, code officiel de
  plaque) — explicitement écartée du périmètre pour ne pas bloquer le MVP sur
  une nomenclature non vérifiée.
- Support des plaques étrangères.
- Ré-interprétation automatique des immatriculations `LEGACY_NEEDS_REVIEW`
  existantes.
