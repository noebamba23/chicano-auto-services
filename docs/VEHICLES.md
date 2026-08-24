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

Le premier véhicule créé par un client devient automatiquement principal.
Si le véhicule principal est archivé, le véhicule actif restant le plus ancien est
automatiquement promu (pour qu'un client actif ne se retrouve jamais sans véhicule
principal tant qu'il a au moins un véhicule actif).

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

## Ce qui n'est pas encore construit

- Historique, Diagnostics, Rapports, Devis, Réparations, Factures, Maintenance,
  Rappels sur la fiche véhicule : sections présentes (ancrées `#diagnostics`,
  `#maintenance`, etc., liées depuis les actions rapides), affichent "Bientôt
  disponible" — l'architecture (schéma Prisma) est prête, la logique métier viendra
  phase par phase (P4 à P8 de la roadmap).
- Historique des relevés kilométriques (modèle prêt, aucune UI/API).
- Durcissement DB de l'unicité du véhicule principal (voir section dédiée ci-dessus).

## Tests exécutés dans cette session

Sans base de données disponible (Docker Desktop toujours non opérationnel — voir
`docs/ROADMAP.md`), ce qui suit a été **réellement vérifié**, et rien de plus :

- `prisma validate` et `prisma generate` : schéma valide, client généré sans erreur.
- `prisma migrate diff --from-empty --to-schema-datamodel` (mode hors-ligne, sans
  connexion DB) : le schéma complet se compile en SQL Postgres valide.
- `tsc --noEmit` : aucune erreur de type sur l'ensemble du projet.
- `eslint` : aucun avertissement.
- `next build` : build de production réussi, toutes les routes attendues générées
  (dont `/api/vehicles`, `/api/vehicles/[id]`, `/api/vehicles/[id]/{archive,
  set-primary,photo}`, `/espace-client/vehicules`, `/espace-client/vehicules/[id]`,
  `/espace-client/vehicules/[id]/modifier`, `/espace-client/vehicules/nouveau`).
- Navigateur (serveur `next dev`, sans DB) :
  - `/espace-client/vehicules` sans session → redirection vers
    `/connexion?next=/espace-client/vehicules` (garde de page, `src/proxy.ts`).
  - `GET /api/vehicles` sans session → `401 {"error":"Non authentifié."}` (garde API,
    `requireVerifiedCustomer()`), confirmant que la protection ne dépend pas
    uniquement du matcher de page.
  - `/` (accueil) toujours fonctionnelle après les changements — pas de régression
    Phase 1 détectée en navigation manuelle.

**Non exécuté** (nécessite une base de données vivante) : création réelle d'un
véhicule, génération effective d'un `CHC-VH-000001`, test d'isolation entre deux
clients (Client A ne peut pas voir le véhicule du Client B), unicité du véhicule
principal sous transaction réelle, upload de photo de bout en bout, migration Prisma
appliquée. À exécuter dès que PostgreSQL est disponible — voir la procédure dans
`docs/ROADMAP.md`.
