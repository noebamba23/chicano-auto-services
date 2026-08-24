# Gestion des véhicules — Phase 2

## Modèle métier

Le véhicule est l'entité centrale de CHICANO : demandes de service, rendez-vous,
diagnostics, rapports, devis, réparations, factures, maintenance et rappels s'y
rattachent tous (`vehicleId` sur chacun de ces modèles dans `prisma/schema.prisma`,
déjà posé en Phase 0).

```
VEHICULE → DEMANDE → RENDEZ-VOUS → DIAGNOSTIC → RAPPORT → DEVIS → RÉPARATION
         → HISTORIQUE → MAINTENANCE → RAPPEL
```

## Identifiant CHICANO Vehicle ID

`chicanoVehicleId` (`CHC-VH-000001`) est un identifiant métier lisible et
recherchable, **jamais** utilisé comme clé primaire (`Vehicle.id` reste un `cuid()`).
Il est dérivé de `Vehicle.sequenceNumber`, une colonne `@default(autoincrement())` —
donc un vrai compteur/séquence Postgres, atomique même sous création concurrente,
sans verrou applicatif à gérer. `createVehicle()` (`src/lib/vehicles/service.ts`)
crée la ligne avec un `chicanoVehicleId` temporaire unique (`pending-<uuid>`), lit le
`sequenceNumber` attribué par Postgres, puis met à jour la ligne avec l'identifiant
final formaté — les deux opérations sont dans la même transaction.

## Véhicule principal

Un seul véhicule actif peut être `isPrimary = true` par client. Cette règle est
appliquée **côté application**, dans une transaction (`setPrimaryVehicle` déselectionne
l'ancien principal avant de sélectionner le nouveau), et non par une contrainte
d'index partiel Postgres — Prisma ORM (schema DSL) ne permet pas d'exprimer un index
unique partiel (`WHERE isPrimary = true`) nativement. C'est une limite connue :
en cas d'écriture concurrente hors du chemin applicatif (ex. requête SQL directe),
l'invariant n'est pas garanti au niveau base. Durcissement possible plus tard : ajouter
manuellement `CREATE UNIQUE INDEX ... ON "Vehicle" ("customerId") WHERE "isPrimary" = true;`
dans une migration Prisma.

Le premier véhicule créé par un client devient automatiquement principal. Un client
peut aussi cocher « Définir comme véhicule principal » dès le formulaire d'ajout (pour
un 2e véhicule ou suivant) — dans ce cas le formulaire crée le véhicule puis appelle
`POST /api/vehicles/[id]/set-primary` juste après.
Si le véhicule principal est archivé, le véhicule actif restant le plus ancien est
automatiquement promu (pour qu'un client actif ne se retrouve jamais sans véhicule
principal tant qu'il a au moins un véhicule actif).

Tenter de définir un véhicule **archivé** comme principal, ou d'archiver un véhicule
**déjà archivé**, renvoie une erreur métier `VehicleConflictError` → `409` (le véhicule
est bien celui du client, mais son état ne permet pas l'opération — voir le catalogue
d'erreurs ci-dessous).

## Suppression / archivage

Pas de suppression physique : `Vehicle.status` passe à `ARCHIVED` (+ `archivedAt`).
Nécessaire car des enregistrements futurs (diagnostics, factures...) référenceront
le véhicule — le supprimer casserait l'intégrité de l'historique.

## Sécurité — ownership

Toute fonction de `src/lib/vehicles/service.ts` qui lit ou modifie un véhicule précis
prend un `customerId` déjà résolu depuis la session et filtre `WHERE id = ... AND
customerId = ...`. Un véhicule qui n'appartient pas à l'appelant se comporte
**exactement** comme un véhicule inexistant (`VehicleNotFoundError` → 404), pour ne
jamais laisser fuiter son existence à un tiers (jamais un 403 qui confirmerait "ce
véhicule existe mais n'est pas à vous").

Les routes API (`src/app/api/vehicles/**`) ne sont **pas** couvertes par le matcher de
`src/proxy.ts` (qui ne protège que les pages) : chacune appelle explicitement
`requireVerifiedCustomer()` (`src/lib/vehicles/guard.ts`), qui vérifie session +
statut `VERIFIED` + résout le `customerId` réel, avant tout accès aux données.

## Valeurs extensibles

`src/lib/vehicles/options.ts` centralise les libellés français des enums Prisma
(`VehicleBodyType`, `FuelType`, `TransmissionType`) — formulaire et affichage
importent ce module unique plutôt que de disperser des chaînes. Ajouter une valeur
nécessite une migration Prisma (ce sont des valeurs métier stables, volontairement pas
une configuration éditable à chaud dans le MVP).

## Kilométrage

`Vehicle.mileage` reste le relevé courant (dénormalisé pour affichage rapide). Le
modèle `MileageReading` (vehicleId, value, source, recordedAt) est posé pour
l'historique des relevés, nécessaire aux futurs rappels d'entretien — **aucune UI ni
API ne l'exploite encore** (hors périmètre de la Phase 2, qui ne demandait que la
préparation du modèle).

## Photo — StorageProvider

Abstraction `StorageProvider` (`src/lib/storage/provider.ts`) sur le même principe que
`MessagingProvider`. Implémentation active par défaut : `LocalStorageProvider`, qui
écrit **réellement** le fichier sous `public/uploads/vehicles/<id>/` et le sert via les
fichiers statiques Next.js — ce n'est pas une URL simulée, le fichier existe et est
servi. Ce backend n'est pas adapté à un déploiement multi-instance (pas de CDN, pas de
durabilité garantie hors disque local).

**Reste à connecter avant production** : un `StorageProvider` objet (S3, Cloudinary,
Supabase Storage...) implémentant la même interface, sélectionné via
`STORAGE_PROVIDER_MODE` (`src/lib/storage/get-provider.ts`) — actuellement seul `local`
est implémenté, toute autre valeur lève une erreur explicite plutôt que d'échouer
silencieusement.

Route : `POST /api/vehicles/[id]/photo` (multipart, `photo` field), JPEG/PNG/WebP,
8 Mo max, ownership vérifiée avant traitement du fichier.

**UI branchée** : `VehiclePhotoUploader` (bouton sur la fiche véhicule, remplace la
photo existante) et le champ fichier du formulaire d'ajout (`VehicleForm`, uploadé
juste après la création du véhicule, puisque la route exige un `vehicleId`
existant). Sans base de données, la vérification d'ownership qui précède l'écriture
échoue avant même d'atteindre le disque — l'utilisateur voit alors une erreur
générique (`500`, jamais la stack Prisma), jamais un faux succès : voir la section
Tests plus bas pour ce qui a pu être vérifié sans DB.

## Catalogue d'erreurs API

| Code | Cas | Origine |
| --- | --- | --- |
| `400` | Payload rejeté par un schéma zod | `jsonFromZodError` — réponse `{ error, fieldErrors }`, le formulaire affiche chaque message sous le champ concerné, pas seulement un message générique |
| `401` | Pas de session valide | `UnauthenticatedError` |
| `403` | Authentifié mais compte non `VERIFIED` | `UnverifiedAccountError` |
| `404` | Véhicule inexistant **ou** appartenant à un autre client | `VehicleNotFoundError` — ces deux cas sont **délibérément fusionnés** : ne jamais confirmer par un `403` qu'un véhicule donné existe mais n'appartient pas à l'appelant |
| `409` | Véhicule possédé mais état incompatible avec l'opération (déjà archivé, ou définir un archivé comme principal) | `VehicleConflictError` |
| `500` | Erreur inattendue | `jsonApiErrorResponse` journalise côté serveur et renvoie un message générique — jamais la stack Prisma brute |

## Ce qui n'est pas encore construit

- Historique, Diagnostics, Rapports, Devis, Réparations, Factures, Maintenance,
  Rappels : la fiche véhicule affiche un état « Historique » vide générique
  (« Votre historique CHICANO apparaîtra ici après votre première intervention. ») et
  3 actions réelles (Diagnostic/Entretien → `/espace-client/demande-service?vehicleId=…`,
  Assistance → `/urgence?vehicleId=…`) — ces routes vérifient l'ownership du véhicule
  transmis et affichent un état « bientôt disponible » assumé, mais ne sont pas des
  liens décoratifs : le Vehicle ID y est réellement propagé et vérifié, prêt pour le
  workflow complet de la Phase 3.
- Historique des relevés kilométriques (modèle `MileageReading` prêt, aucune UI/API).
- Durcissement DB de l'unicité du véhicule principal (voir section dédiée ci-dessus).
- Backend de stockage production (S3/Cloudinary/Supabase Storage) — seul `local` est
  implémenté.

## Tests automatisés (Vitest)

`npm test` (`vitest run`) — 34 tests, 4 fichiers, tous verts :

- `src/lib/validation/vehicles.test.ts` — schéma zod pur (marque/modèle obligatoires,
  immatriculation obligatoire, VIN facultatif, année et kilométrage bornés, enums
  invalides rejetés). Aucune base de données impliquée.
- `src/lib/vehicles/vehicle-id.test.ts` — formatage `CHC-VH-000001`.
- `src/lib/vehicles/service.test.ts` — logique métier de `service.ts` (création,
  génération d'ID, liste filtrée par client, **ownership interdit** sur
  get/update/setPrimary/archive pour un véhicule d'un autre client, mise à jour
  partielle, unicité + bascule du véhicule principal, promotion automatique à
  l'archivage, conflit 409 sur archivé→principal et archivé→archiver).
- `src/lib/vehicles/guard.test.ts` — `requireVerifiedCustomer()` : utilisateur non
  authentifié, compte suspendu, compte `PENDING_VERIFICATION`, résolution du
  customerId pour un compte vérifié.

**Important — ce que ces tests couvrent et ne couvrent PAS** : `service.test.ts` et
`guard.test.ts` utilisent un faux client Prisma écrit à la main
(`src/lib/vehicles/test-utils/fake-db.ts`), en mémoire, qui ne reproduit que le
sous-ensemble d'API utilisé par `service.ts` (filtrage par égalité, `NOT`, tri sur
`isPrimary`/`createdAt`, transactions qui s'exécutent simplement l'une après l'autre).
Ce sont donc des **tests unitaires de la logique applicative**, pas des tests
d'intégration contre un vrai Postgres : ils ne vérifient ni les contraintes réelles de
la base, ni le comportement transactionnel sous concurrence réelle, ni que le SQL
généré par Prisma fait bien ce qu'on attend. Ne pas les confondre avec les tests DB de
la section suivante, qui restent à exécuter contre une vraie instance.

## Tests exécutés dans cette session (sans base de données)

Docker Desktop reste non opérationnel sur cette machine (voir `docs/ROADMAP.md`). Ce
qui suit a été **réellement vérifié**, et rien de plus :

- `prisma validate` et `prisma generate` : schéma valide, client généré sans erreur.
- `prisma migrate diff --from-empty --to-schema-datamodel` (mode hors-ligne, sans
  connexion DB) : le schéma complet se compile en SQL Postgres valide.
- `npm test` (Vitest) : 34/34 tests verts — voir ci-dessus.
- `tsc --noEmit` : aucune erreur de type sur l'ensemble du projet.
- `eslint` : aucun avertissement.
- `next build` : build de production réussi, toutes les routes attendues générées.
- Navigateur (serveur `next dev`, sans DB) :
  - `/espace-client/vehicules` sans session → redirection vers
    `/connexion?next=/espace-client/vehicules` (garde de page, `src/proxy.ts`).
  - `GET /api/vehicles` sans session → `401 {"error":"Non authentifié."}` (garde API,
    `requireVerifiedCustomer()`), confirmant que la protection ne dépend pas
    uniquement du matcher de page.
  - `/` (accueil) toujours fonctionnelle après les changements — pas de régression
    Phase 1 détectée en navigation manuelle.

**Non exécuté** (nécessite une base de données vivante) : création réelle d'un
véhicule contre Postgres, génération effective d'un `CHC-VH-000001` via la séquence
native, isolation réelle entre deux comptes clients de bout en bout (navigateur),
unicité du véhicule principal sous transaction Postgres réelle, upload de photo de
bout en bout (écriture disque + enregistrement DB), migration Prisma appliquée. À
exécuter dès que PostgreSQL est disponible — voir la procédure dans `docs/ROADMAP.md`.
