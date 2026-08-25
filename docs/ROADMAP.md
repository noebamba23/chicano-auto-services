# Roadmap — CHICANO AUTO SERVICES Platform

Suivi par phase, dans l'ordre imposé par la section 70 du cahier des charges.
Ne pas paralléliser les phases : chacune se construit sur la précédente.

| Phase | Contenu | Statut |
| --- | --- | --- |
| P0 | Audit + architecture | ✅ Fait — voir `ARCHITECTURE.md` |
| P1 | Auth + vérification WhatsApp | ✅ Fait — inscription, OTP (mock/meta), connexion, session, garde d'accès, audit log |
| P2 | Client + véhicules | ✅ Fait — voir `VEHICLES.md` ; validé contre PostgreSQL réel (Neon) en P2.5 |
| P2.5 | Validation PostgreSQL réel (Neon) | ✅ Fait — migration initiale appliquée, auth + véhicules + ownership validés en conditions réelles |
| P3 | Demandes + urgence + géolocalisation + rendez-vous | ✅ Fait — voir `SERVICE-REQUESTS.md` |
| P4 | Production (suite) + Kanban + calendrier + affectation technicien basique | ✅ Fait — voir `SERVICE-REQUESTS.md` (section Phase 4) |
| P5 | Application technicien complète + diagnostic | ⏳ À faire |
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
- Fiche véhicule (`/espace-client/vehicules/[id]`) : en-tête premium (nom, résumé,
  Vehicle ID), section Informations, 3 actions réelles (Diagnostic/Entretien/
  Assistance, Vehicle ID propagé et vérifié vers les routes cibles), section
  Historique avec état vide assumé.
- Création (`/espace-client/vehicules/nouveau`) et modification
  (`/espace-client/vehicules/[id]/modifier`), formulaire partagé `VehicleForm`
  sectionné (Identification / Caractéristiques / Utilisation / Photo / Options),
  erreurs de validation affichées sous chaque champ (pas seulement un message
  générique), valeurs d'enum centralisées dans `src/lib/vehicles/options.ts`.
- Upload photo branché : sur la fiche véhicule (`VehiclePhotoUploader`, remplacement
  possible) et dès la création (le fichier choisi est envoyé juste après la création
  du véhicule).
- `CHC-VH-000001` généré depuis un compteur natif Postgres (`sequenceNumber`
  autoincrement), jamais utilisé comme clé primaire — détails dans `VEHICLES.md`.
- Véhicule principal unique par client (première création auto-principale, case à
  cocher "définir comme principal" dès l'ajout, ré-assignation possible, promotion
  automatique à l'archivage du principal).
- Archivage (pas de suppression physique) pour préserver l'intégrité de l'historique
  futur (diagnostics, factures...) — conflit `409` explicite sur un véhicule déjà
  archivé ou tenter de le définir comme principal.
- Ownership strictement vérifiée côté serveur sur toutes les routes
  (`src/lib/vehicles/service.ts` + `guard.ts`) — un véhicule d'un autre client se
  comporte comme un véhicule inexistant (404), jamais un 403 révélateur. Catalogue
  d'erreurs complet (400/401/403/404/409/500) dans `VEHICLES.md`.
- `StorageProvider` (upload photo) avec implémentation `local` fonctionnelle
  (écrit réellement sous `public/uploads/`, pas une URL simulée) — détails et limites
  dans `VEHICLES.md`.
- Route `/espace-client/demande-service?vehicleId=…&type=…` : pas un lien décoratif —
  ownership du véhicule vérifiée, état "bientôt disponible" assumé en attendant la
  Phase 3.
- 34 tests unitaires (Vitest) sur la validation, la génération d'ID, la logique
  d'ownership, la bascule du véhicule principal et l'archivage — voir `VEHICLES.md`
  pour ce qu'ils couvrent (logique applicative) et ne couvrent pas (pas de Postgres
  réel).
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

## Détail Phase 3 (livrée)

- Assistant de demande mobile-first en une page (`/espace-client/demande-service`,
  `ServiceRequestWizard`) : véhicule pré-rempli (Vehicle ID jamais ressaisi) →
  service → problème (+ photo/vidéo facultatives) → mode d'intervention → urgence →
  localisation (si mobile) → date/créneau → récapitulatif modifiable → envoi.
- `CHC-SR-000001` généré depuis un compteur natif Postgres, même mécanisme que
  `CHC-VH-000001` — voir `SERVICE-REQUESTS.md`.
- Séparation stricte `ServiceRequest` (la demande) / `Appointment` (le rendez-vous,
  n'existe qu'après acceptation) — pas de nouveau modèle pour l'historique,
  réutilisation de `AuditLog` (Phase 0).
- Géolocalisation contexte malien : GPS (API navigateur) + adresse libre combinables,
  jamais un format d'adresse strict imposé.
- `MapService` posé (abstraction) avec implémentation OpenStreetMap sans dépendance
  ni clé API.
- `NotificationService` construit et branché sur le `WhatsAppProvider` existant
  (mock en dev) — 5 nouveaux événements ajoutés à `NotificationEvent`.
- Espace client : `Mes demandes` (liste + détail + annulation) avec statuts
  contrôlés côté serveur (table de transitions explicite, jamais modifiable par le
  frontend).
- Première version de l'espace production (`/production/demandes`, RBAC
  `PRODUCTION_STAFF`/`ADMIN`/`SUPER_ADMIN`) : liste filtrée (urgentes/mobile/
  garage/statut) + fiche demande avec actions Accepter/Refuser/Demander autre
  créneau.
- Ownership (client) et RBAC (production) vérifiés côté serveur sur toutes les
  routes — un client ne peut jamais appeler accept/reject/reschedule, même sur sa
  propre demande.
- 27 nouveaux tests unitaires (validation, ownership, transitions, RBAC) —
  61 au total. Voir `SERVICE-REQUESTS.md` pour ce qui a été validé en conditions
  réelles (Neon, navigateur) au-delà de ces tests unitaires.
- Documentation complète : `docs/SERVICE-REQUESTS.md`.

## Non couvert par la Phase 3 (volontairement)

Diagnostic complet, rapport de diagnostic, devis, réparation, facturation,
application technicien complète, Kanban/calendrier production, réponse client à une
contre-proposition de créneau, marqueur de carte déplaçable — voir
`SERVICE-REQUESTS.md` pour le détail de chaque limite assumée.

## Détail Phase 4 (livrée)

- Kanban (`/production/kanban`) : colonnes = statuts `ServiceRequest` réellement
  pilotables (Nouvelles, En examen, Nouveau créneau proposé, Planifiées, Terminées)
  + section compacte Refusées/Annulées. Interaction par clic (pas de
  glisser-déposer) — chaque carte ouvre la fiche demande où vivent les actions déjà
  auditées en Phase 3.
- Calendrier (`/production/calendrier`) : vue semaine, grille créneau × jour,
  navigation précédent/suivant.
- Deux nouvelles transitions exposées (déjà prévues dans `ALLOWED_TRANSITIONS`
  depuis la Phase 3, jusqu'ici inutilisées) : « Mettre en examen »
  (`SUBMITTED → UNDER_REVIEW`) et « Marquer terminée » (`ACCEPTED → COMPLETED`,
  ferme aussi l'`Appointment` lié).
- Affectation technicien basique (`/production/techniciens`, formulaire sur la
  fiche demande) : `TechnicianAssignment` posé en Phase 0, aucun changement de
  schéma. Empêche la double réservation d'un même technicien sur un même
  date+créneau ; réaffectation conservée en historique (`status = REASSIGNED`,
  jamais supprimée).
- 12 nouveaux tests unitaires (transitions Kanban, affectation, double
  réservation) — 73 au total.
- Documentation : section dédiée dans `docs/SERVICE-REQUESTS.md`.

## Non couvert par la Phase 4 (volontairement)

Application technicien complète (JE PARS/ARRIVÉ, diagnostic terrain), vue
calendrier mois, glisser-déposer Kanban, diagnostic/rapport/devis/réparation/
facturation — voir `SERVICE-REQUESTS.md` pour le détail.

## PostgreSQL

Résolu en Phase 2.5 : Docker Desktop restait bloqué sur cette machine (jamais
dépassé son initialisation depuis l'installation) — contournement définitif via
**Neon** (PostgreSQL cloud), `DATABASE_URL` pointant vers un projet Neon réel depuis
lors. Toutes les migrations (P2.5, P3 — aucune nouvelle migration en P4, le schéma
existant suffisait) ont été appliquées et validées contre cette base réelle, pas
contre un mock.
