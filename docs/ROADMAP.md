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
| P5 | Application technicien complète + diagnostic | ✅ Fait — voir `TECHNICIAN-APP.md` |
| P6 | Rapport + devis | ✅ Fait — voir `REPORTS-QUOTES.md` |
| P7 | Validation + réparation + clôture | ✅ Fait — voir `WORK-ORDERS.md` |
| P8 | Historique + rappels | ✅ Fait — voir `MAINTENANCE.md` |
| P9 | Facturation, paiements & rentabilité | ✅ Fait — voir `BILLING.md` (le libellé initial "CRM + KPI" est partiellement couvert : dashboard KPI livré, CRM avancé reste à faire) |
| P10 | CRM, Customer 360 & CHICANO CARE | ✅ Fait — voir [`CRM.md`](CRM.md) et [`CHICANO-CARE.md`](CHICANO-CARE.md) (le libellé initial "B2B / Fleet" n'est que partiellement couvert : préparation posée — `CustomerType.FLEET`, `Company`/`Fleet`/`FleetContract` réutilisés tels quels — B2B/flotte complet reste à faire) |

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

## Détail Phase 5 (livrée)

- Espace technicien (`/technicien`, rôle `TECHNICIAN`) : tableau de bord de
  ses affectations, fiche intervention avec actions "Je pars"/"Je suis
  arrivé" (`Appointment.status` devient réellement granulaire :
  ASSIGNED → TECHNICIAN_EN_ROUTE → ARRIVED → IN_PROGRESS, valeurs posées au
  schéma depuis la Phase 0 mais inutilisées jusqu'ici).
- Module diagnostic terrain : démarrage (idempotent) une fois `ARRIVED`,
  checklist 10 catégories (`DiagnosticCheck`, upsert par catégorie), codes
  défaut libres (`DiagnosticFaultCode`), clôture (`Diagnostic.status`
  `COMPLETED`, clôt aussi `TechnicianAssignment.status`). Ne clôt PAS
  `Appointment`/`ServiceRequest` — action "Marquer terminée" (Phase 4)
  toujours seule responsable de cette clôture administrative.
- Redirection post-connexion et garde de rôle unifiées
  (`src/lib/auth/home-for-role.ts`) : chaque rôle a désormais son propre
  espace protégé (`/espace-client`, `/production`, `/technicien`) — avant
  cette phase, `/espace-client` était accessible à n'importe quel rôle
  authentifié (juste avec un tableau de bord vide pour un non-client), gap
  corrigé ici plutôt que différé.
- Visibilité production en lecture seule sur `/production/demandes/[id]`
  (statut diagnostic, points de contrôle, codes défaut) — pas encore le
  rapport client formaté (Phase 6).
- 13 nouveaux tests unitaires (86 au total).
- Documentation complète : `docs/TECHNICIAN-APP.md`.

## Non couvert par la Phase 5 (volontairement)

Rapport de diagnostic formaté et photos de preuve (`DiagnosticReport`/
`ReportPhoto`), devis, réparation, validation client, facturation,
géolocalisation temps réel du technicien, réaffectation en cours de
diagnostic — voir `TECHNICIAN-APP.md` pour le détail de chaque limite
assumée.

## Détail Phase 6 (livrée)

- Rapport de diagnostic (`DiagnosticReport`) : brouillon éditable
  (conclusion, sévérité, photos de preuve réelles via `StorageProvider`) tant
  que non publié ; publication = figeage définitif, plus aucune modification
  possible ensuite. Un brouillon n'est jamais visible côté client.
- Devis versionné (`Quote`/`QuoteVersion`/`QuoteItem`) : cycle complet
  DRAFT → SENT → ACCEPTED/REJECTED/MODIFICATION_REQUESTED, avec émission
  d'une nouvelle version (jamais d'édition en place) après une demande de
  modification client. Un nouveau devis reste possible après un refus.
- Une seule nouvelle migration depuis la Phase 3 : ajout de
  `sequenceNumber` sur `DiagnosticReport` et `Quote` (généré à la main,
  `prisma migrate dev` refusant de tourner en non interactif — déjà rencontré
  en Phase 3 — puis appliqué via `prisma migrate deploy`).
- Interface client : `/espace-client/rapports` et `/espace-client/devis`
  (liste + détail), les deux entrées du tableau de bord passent de
  `available: false` à actives.
- Interface production : deux nouvelles sections sur la fiche demande
  existante (`ReportEditor`, `QuoteEditor`), aucune nouvelle URL de
  production.
- 18 nouveaux tests unitaires (104 au total).
- Documentation complète : `docs/REPORTS-QUOTES.md`.

## Non couvert par la Phase 6 (volontairement)

`WorkOrder` (ordre de travail, réparation — Phase 7), facturation, carnet
d'entretien, expiration automatique des devis, affichage du motif de refus/
de la note de modification côté UI production (journalisé mais pas encore
affiché) — voir `REPORTS-QUOTES.md` pour le détail de chaque limite assumée.

## Détail Phase 7 (livrée)

- Work Order (`WorkOrder`/`WorkOrderItem`/`WorkOrderPart`/`WorkOrderPhoto`) :
  créé automatiquement à l'acceptation d'un devis (`acceptQuote()`), jamais
  via une route manuelle. Récupère automatiquement client/véhicule/
  ServiceRequest/rendez-vous/technicien déjà affecté/rapport de
  diagnostic/lignes du devis accepté.
- Refonte du placeholder `WorkOrder`/`WorkOrderTask` posé en Phase 0
  (confirmé vide sur Neon avant modification, aucune perte de donnée) ;
  `WorkshopTransfer` conservé pour l'embarquement garage (intervention
  mobile impossible sur place).
- Cycle de statuts complet (`DRAFT → READY → SCHEDULED → IN_PROGRESS →
  QUALITY_CHECK → COMPLETED`, branches `WAITING_PARTS`/`ON_HOLD`,
  `CANCELLED`), transitions validées uniquement côté serveur — même
  discipline que `ServiceRequestStatus`.
- Contrôle qualité obligatoire avant `COMPLETED` (`qualityCheckPassed/
  Notes/CheckedById/CheckedAt`, essai véhicule).
- Pièces (statuts REQUESTED → RECEIVED → INSTALLED, volontairement pas un
  ERP de stock) et travaux (repris du devis accepté, jamais modifiables
  librement par un technicien).
- Travaux supplémentaires : signal léger (`additionalWorkRequested`) sans
  jamais modifier le devis accepté.
- Interfaces production (`/production/work-orders`), client
  (`/espace-client/reparations`) et technicien (`/technicien/reparations`).
- 7 nouveaux événements `NotificationEvent` (2 non diffusés, signaux
  internes production sans mécanisme de diffusion à un rôle dans ce
  projet).
- 22 nouveaux tests unitaires (167 au total) + vérification réelle Neon +
  navigateur (production/client/technicien, une transition de statut
  réelle bout en bout).
- Documentation complète : `docs/WORK-ORDERS.md`.

## Non couvert par la Phase 7 (volontairement)

Facturation, paiement, comptabilité, rapprochement stock réel
(`Inventory`), système de remorquage complet, diffusion de notification à
un rôle plutôt qu'à un utilisateur unique — voir `WORK-ORDERS.md` pour le
détail de chaque limite assumée.

## Détail Phase 8 (livrée)

- Carnet automobile numérique : historique véhicule agrégé à la volée depuis
  les événements métier existants (`ServiceRequest`/`DiagnosticReport`
  publié/`WorkOrder` terminé) — aucune table dupliquée, timeline filtrable
  et paginée sur la fiche véhicule client.
- Kilométrage : `MileageReading` (Phase 2, jamais exploité) activé — relevé
  historisé, garde anti-régression (bloquée côté client, corrigeable de
  façon explicite par la production/le technicien, toujours auditée).
- `MaintenancePlan`/`MaintenanceReminder` (Phase 0, jamais exploités)
  étendus : `MaintenanceType` élargi à 16 opérations, `ReminderStatus`
  aligné (PENDING/SCHEDULED/SENT/COMPLETED/CANCELLED), plan par véhicule
  (jamais de liste universelle imposée).
- Niveaux d'alerte progressifs (UPCOMING/DUE/OVERDUE) calculés à la volée,
  déclenchement par date OU kilométrage (le plus urgent gagne), anti-spam
  (jamais deux fois la même alerte).
- Un entretien n'est réalisé que via un `WorkOrder` réellement terminé
  (jamais déclaré par le client) — clôture du rappel + calcul automatique
  de la prochaine échéance.
- "Prendre rendez-vous" depuis un rappel réutilise `createServiceRequest()`
  existant — jamais un `Appointment` confirmé créé directement.
- Interfaces client (fiche véhicule, dashboard), production (Control Center
  "Maintenance", nouvelle fiche véhicule production) et technicien (relevé
  kilométrique).
- 42 nouveaux tests unitaires (209 au total) + vérification réelle Neon +
  navigateur (client, production, workflow rappel → demande de service
  bout en bout).
- Documentation complète : `docs/MAINTENANCE.md`.

## Non couvert par la Phase 8 (volontairement)

Automatisation réelle des rappels (aucun scheduler/cron dans ce projet —
déclenchement manuel), génération automatique d'un plan depuis marque/
modèle (aucune source constructeur vérifiée), système EV/Hybride
spécialisé, diffusion de notification à un rôle — voir `MAINTENANCE.md`
pour le détail de chaque limite assumée.

## Détail Phase 9 (livrée)

- Facturation (`Invoice`/`InvoiceItem`) : créée automatiquement quand un
  Work Order passe à `COMPLETED` (`passQualityCheck()`), snapshot des
  lignes (jamais recalculé depuis le devis), idempotente. Cycle
  DRAFT → ISSUED → (PARTIALLY_PAID/OVERDUE) → PAID/CANCELLED.
- Paiement (`Payment`) : acomptes multiples, solde recalculé, invariants
  serveur (jamais `amountPaid > total`, jamais un montant ≤ 0). Reçu
  (`CHC-RC-000001`) posé sur le paiement confirmé, pas une table séparée.
- `PaymentProvider` (Cash/Mobile Money) : Espèces/virement/autre confirment
  immédiatement (attestation production), Orange/Moov/Wave retournent
  toujours `NOT_CONFIGURED` — aucune intégration API réelle, jamais de faux
  paiement `PAID`.
- Marge interne (`WorkOrderItem.costPrice`, jamais exposée au client ni au
  technicien) : revenu - coût pièces - coût main-d'œuvre - coût autre.
- Dashboard production (`/production/facturation`) et dashboard CEO
  (`/production/dashboard`, KPI calculés depuis les données réelles).
- Espace client (`/espace-client/factures`) avec bouton Payer (Mobile
  Money uniquement, jamais CASH côté client).
- 19 nouveaux tests unitaires (228 au total) + vérification réelle Neon
  (scénario complet acompte → solde → PAID) + navigateur (client, production,
  dashboard).
- Documentation complète : `docs/BILLING.md`.

## Non couvert par la Phase 9 (volontairement)

Intégration API réelle Mobile Money, régime fiscal automatique, coût de
déplacement distinctement suivi, génération PDF de facture, automatisation
réelle du passage en retard (déclenchement manuel), CHICANO CARE
(abonnements) et B2B/flotte complets — voir `BILLING.md` pour le détail de
chaque limite assumée.

## Détail Phase 10 (livrée)

- Segmentation comportementale déterministe (`NEW`/`ACTIVE`/`RECURRING`/
  `DORMANT`/`AT_RISK`/`VIP`) et parcours client, calculés à la volée
  depuis les données réelles — aucun score IA, aucun champ stocké à
  resynchroniser (même discipline que `MaintenanceReminderLevel`,
  Phase 8).
- Customer 360 (`getCustomer360()`) : agrège véhicules, demandes,
  rendez-vous, devis, ordres de réparation, factures (y compris DRAFT),
  paiements (déjà portés par chaque facture), rapports de diagnostic
  publiés, rappels de maintenance, interactions, relances et CHICANO CARE
  — chaque section lue via la fonction déjà existante de son domaine,
  aucun second historique créé. Liens vers les fiches détail production
  déjà existantes.
- Consentement (`whatsappOptIn`/`emailOptIn`/`smsOptIn`/`marketingOptIn`),
  strictement séparé des notifications transactionnelles existantes
  (jamais gatées) — une campagne marketing exige `marketingOptIn = true`,
  y compris pour un client déjà opt-in WhatsApp.
- Interactions (`CustomerInteraction`, 7 types) et relances
  (`FollowUp`, `PENDING`/`DONE`/`CANCELLED`) — toujours manuelles, jamais
  déclenchées automatiquement par un signal de segmentation.
- Campagnes (`Campaign`, `DRAFT → SCHEDULED/RUNNING → COMPLETED/
  CANCELLED`) : ciblage recalculé au moment de l'envoi, mode PREVIEW
  obligatoire, aucun scheduler réel, aucun provider EMAIL/SMS réel,
  WhatsApp mock jamais présenté comme actif.
- CHICANO CARE (`CarePlan`/`CareSubscription`, `ACTIVE`/`PAUSED`/
  `CANCELLED`/`EXPIRED`) : catalogue à prix libres, réutilise
  intégralement le moteur de maintenance existant (Phase 8), "Prendre
  rendez-vous" crée toujours une `ServiceRequest` — jamais un
  `Appointment` direct. Aucun paiement récurrent automatique, les
  paiements restent le flux manuel de la Phase 9.
- Parrainage (`Referral`) : architecture préparatoire uniquement, pas de
  système d'affiliation complet.
- `requireAdminRole()` ajouté (même pattern que `requireProductionRole()`)
  — aucun rôle Manager créé (voir `CRM.md`).
- Interfaces production (`/production/crm`, `/production/crm/clients`,
  `/production/crm/follow-ups`, `/production/crm/care-plans`,
  `/production/crm/campaigns`) et client (`/espace-client/care`,
  `/espace-client/parametres`).
- 4 nouveaux événements `NotificationEvent` (`CARE_STARTED`/
  `CARE_EXPIRING`/`CARE_EXPIRED`/`FOLLOW_UP_DUE`), templates seedés
  (39 au total).
- 40 nouveaux tests unitaires (268 au total) + vérification réelle Neon
  (29/29 assertions, y compris ownership cross-customer sur tous les
  domaines Customer 360) + navigateur (client, production, RBAC, mode
  PREVIEW, ownership).
- Documentation complète : [`CRM.md`](CRM.md) et
  [`CHICANO-CARE.md`](CHICANO-CARE.md).

## Non couvert par la Phase 10 (volontairement)

Marketing automation complexe, scoring par IA, paiement récurrent
automatique, ERP, fleet management complet, système d'affiliation
complet, intégration WhatsApp Business API réelle (mock tant
qu'aucun credential n'est configuré), moteur de recommandation IA,
CHICANO POINTS/fidélité (aucun barème d'accrual fourni — non inventé),
lien stocké `MaintenanceReminder` → `ServiceRequest` (le "taux rappel →
rendez-vous" du dashboard CEO reste une approximation) — voir `CRM.md`
et `CHICANO-CARE.md` pour le détail de chaque limite assumée.

## PostgreSQL

Résolu en Phase 2.5 : Docker Desktop restait bloqué sur cette machine (jamais
dépassé son initialisation depuis l'installation) — contournement définitif via
**Neon** (PostgreSQL cloud), `DATABASE_URL` pointant vers un projet Neon réel depuis
lors. Toutes les migrations (P2.5, P3, P6, P7, P8, P9, P10 — aucune nouvelle migration en
P4/P5, le schéma existant suffisait) ont été appliquées et validées contre
cette base réelle, pas contre un mock.
