# Roadmap — CHICANO AUTO SERVICES Platform

Suivi par phase, dans l'ordre imposé par la section 70 du cahier des charges.
Ne pas paralléliser les phases : chacune se construit sur la précédente.

| Phase | Contenu | Statut |
| --- | --- | --- |
| P0 | Audit + architecture | ✅ Fait — voir `ARCHITECTURE.md` |
| P1 | Auth + vérification WhatsApp | ✅ Fait — inscription, OTP (mock/meta), connexion, session, garde d'accès, audit log |
| P2 | Client + véhicules | ✅ Fait (code) — voir `VEHICLES.md` ; tests DB réels en attente de PostgreSQL |
| P3 | Demandes + urgence + géolocalisation | ⏳ À faire |
| P4 | Rendez-vous + production | ⏳ À faire — dashboard, Kanban, calendrier |
| P5 | Technicien + diagnostic | ⏳ À faire |
| P6 | Rapport + devis | ⏳ À faire |
| P7 | Validation + réparation + clôture | ⏳ À faire |
| P8 | Historique + rappels | ⏳ À faire |
| P9 | CRM + KPI | ⏳ À faire |
| P10 | B2B / Fleet | ⏳ À faire |

## Détail Phase 1 (livrée)

- Inscription (`/inscription`) : prénom, nom, WhatsApp, email optionnel, mot de
  passe, acceptation des conditions.
- Vérification WhatsApp (`/verification-whatsapp`) : code à 6 chiffres, renvoi avec
  cooldown configurable, tentatives limitées, expiration.
- Connexion (`/connexion`) par téléphone + mot de passe.
- Session distincte de la vérification OTP (cookie JWT httpOnly + table `Session`
  pour révocation).
- Garde d'accès `src/proxy.ts` (Node.js runtime, Next.js 16) : redirige les visiteurs
  non authentifiés hors des espaces protégés, et les comptes `PENDING_VERIFICATION`
  vers l'écran de vérification.
- `WhatsAppVerificationService` avec fournisseur `mock` (dev, log serveur) ou `meta`
  (Meta WhatsApp Business Cloud API) sélectionné par `WHATSAPP_PROVIDER_MODE`.
- Audit log sur inscription et vérification WhatsApp.
- Schéma Prisma complet (toutes les tables de la section 62), migration à appliquer
  dès qu'une base PostgreSQL est disponible.

## Détail Phase 2 (livrée)

- Mes véhicules (`/espace-client/vehicules`) : liste, compteur, véhicule principal,
  ajout.
- Fiche véhicule (`/espace-client/vehicules/[id]`) : identité complète + sections
  Historique/Diagnostics/Rapports/Devis/Réparations/Factures/Maintenance/Rappels
  ("Bientôt disponible", ancrées pour les actions rapides Diagnostic/Entretien).
- Création (`/espace-client/vehicules/nouveau`) et modification
  (`/espace-client/vehicules/[id]/modifier`), formulaire partagé
  `VehicleForm`, valeurs d'enum centralisées dans `src/lib/vehicles/options.ts`.
- `CHC-VH-000001` généré depuis un compteur natif Postgres (`sequenceNumber`
  autoincrement), jamais utilisé comme clé primaire — détails dans `VEHICLES.md`.
- Véhicule principal unique par client (première création auto-principale,
  ré-assignation possible, promotion automatique à l'archivage du principal).
- Archivage (pas de suppression physique) pour préserver l'intégrité de l'historique
  futur (diagnostics, factures...).
- Ownership strictement vérifiée côté serveur sur toutes les routes
  (`src/lib/vehicles/service.ts` + `guard.ts`) — un véhicule d'un autre client se
  comporte comme un véhicule inexistant (404), jamais un 403 révélateur.
- `StorageProvider` (upload photo) avec implémentation `local` fonctionnelle
  (écrit réellement sous `public/uploads/`, pas une URL simulée) — détails et limites
  dans `VEHICLES.md`.
- Documentation complète : `docs/VEHICLES.md`.

## Non couvert par la Phase 2 (volontairement)

- Demande de service, urgence, rendez-vous, dashboard production, diagnostic,
  rapport, devis, facturation, CRM, B2B — chacun sera livré dans sa propre phase.
- Historique des relevés kilométriques (modèle `MileageReading` posé, aucune UI/API).
- Backend de stockage production (S3/Cloudinary/Supabase Storage) — seul le mode
  `local` (dev) est implémenté.
- Durcissement DB de l'unicité "un seul véhicule principal par client" (appliquée
  aujourd'hui en transaction applicative, pas par contrainte Postgres — voir
  `VEHICLES.md`).

## Blocage connu à ce jour

Docker Desktop n'a toujours pas terminé son initialisation sur cette machine (le
moteur ne répond pas — probablement une étape de premier lancement nécessitant une
interaction manuelle, ex. acceptation des conditions d'utilisation ou mise à jour du
noyau WSL2). Aucune migration Prisma n'a donc pu être appliquée dans cette session, ni
en Phase 1 ni en Phase 2. Ce qui a pu être vérifié sans base de données (schéma,
types, lint, build, garde d'accès) est détaillé dans `VEHICLES.md`.

Procédure dès que PostgreSQL est disponible :

1. `docker compose up -d`
2. `npm run db:migrate` — première migration réelle, couvrant Phase 0 + 1 + 2 en une
   fois (aucune migration n'a encore été appliquée à ce jour).
3. `npm run db:seed`
4. Exécuter le parcours complet en navigateur (inscription → OTP → connexion → ajout
   véhicule → fiche → modification → véhicule principal → archivage) et confirmer
   l'isolation entre deux comptes clients distincts.
