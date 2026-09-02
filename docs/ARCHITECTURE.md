# CHICANO AUTO SERVICES — Architecture (Phase 0 à Phase 3)

Ce document répond aux points 1 à 11 de la section 71 du cahier des charges
(« Première étape — avant de coder ») pour l'état actuel du projet. Le détail
spécifique à la gestion des véhicules (Phase 2) est dans [`VEHICLES.md`](VEHICLES.md),
celui des demandes de service/rendez-vous (Phase 3) dans
[`SERVICE-REQUESTS.md`](SERVICE-REQUESTS.md).

## 1. Stack actuelle

Le dossier `CHICANO AUTO SERVICES` ne contenait, avant ce chantier, que des documents
de cadrage (PDF, docx, logos) — aucun code. La stack a été choisie et mise en place
dans cette session :

- **Next.js 16** (App Router, Turbopack) + **TypeScript** — une seule codebase
  frontend/backend, conforme à la section 61.
- **Tailwind CSS v4** pour l'UI.
- **PostgreSQL** via **Prisma ORM v6** (la v7, tout juste sortie, impose une refonte
  de configuration `prisma.config.ts` + adaptateur pilote encore instable pour un
  MVP — décision d'architecture : rester sur la v6, stable et documentée, jusqu'à
  maturation de la v7). Base réelle hébergée sur **Neon** (PostgreSQL cloud) depuis
  la Phase 2.5 — Docker Desktop local restant bloqué sur cette machine (jamais
  dépassé son initialisation depuis l'installation), contourné définitivement via
  Neon plutôt que de bloquer le projet.
- **Auth maison** : session JWT (`jose`) en cookie httpOnly, mots de passe hashés
  `bcryptjs`. Section 61 proposait Supabase Auth ; sans compte Supabase configuré,
  une solution auto-hébergée équivalente (mêmes garanties : hachage fort, session
  signée, révocation en base) a été retenue pour rester actionnable immédiatement.
- **WhatsApp** : abstraction `MessagingProvider` → `WhatsAppProvider`, deux
  implémentations (`mock` dev, `meta` production via Cloud API).

## 2. Architecture actuelle (arborescence)

```
src/
  app/
    page.tsx                        Accueil (hero, comment ça marche, services...)
    inscription/page.tsx            Créer mon compte CHICANO
    verification-whatsapp/page.tsx  Vérification OTP WhatsApp
    connexion/page.tsx              Connexion
    urgence/page.tsx                Placeholder (flux complet = Phase 3)
    espace-client/
      layout.tsx                   Garde de session + habillage espace client
      page.tsx                     Tableau de bord client (Bonjour {prénom}, véhicule principal...)
      vehicules/
        page.tsx                   Mes véhicules (liste)
        nouveau/page.tsx           Ajouter mon véhicule
        [id]/page.tsx              Fiche véhicule (identité + actions + historique)
        [id]/modifier/page.tsx     Modifier mon véhicule
      demande-service/page.tsx    Assistant de demande (8 étapes, ServiceRequestWizard) — vehicleId requis
      demandes/
        page.tsx                  Mes demandes (liste)
        [id]/page.tsx              Détail + annulation
      rapports/
        page.tsx                  Mes rapports (liste, publiés uniquement) (P6)
        [id]/page.tsx              Détail (conclusion, sévérité, photos, points de contrôle) (P6)
      devis/
        page.tsx                  Mes devis (liste, hors DRAFT) (P6)
        [id]/page.tsx              Détail + Accepter/Refuser/Demander modification (P6)
      reparations/
        page.tsx                  Mes réparations (liste) (P7)
        [id]/page.tsx              Détail en lecture seule (P7)
      vehicules/[id]/page.tsx      + section Entretien/timeline historique (P8)
      factures/
        page.tsx                  Mes factures (liste, hors DRAFT) (P9)
        [id]/page.tsx              Détail + bouton Payer (Mobile Money) (P9)
      care/page.tsx                CHICANO CARE — abonnements + prochains entretiens (P10)
      parametres/page.tsx          Préférences de communication (consentement) (P10)
    production/
      layout.tsx                   Garde RBAC (PRODUCTION_STAFF/ADMIN/SUPER_ADMIN), dark mode, nav (P4)
      demandes/
        page.tsx                   Control Center — liste filtrée
        [id]/page.tsx              Fiche + actions + affectation technicien (P4)
      kanban/page.tsx              Colonnes = statuts pilotables, clic → fiche (P4)
      calendrier/page.tsx          Vue semaine, créneau × jour (P4)
      work-orders/
        page.tsx                   Work Orders — colonnes par statut (P7)
        [id]/page.tsx              Fiche + actions (planifier/affecter/transitions/contrôle qualité) (P7)
      maintenance/page.tsx         Rappels actifs (filtres) + véhicules sans plan (P8)
      vehicules/[id]/page.tsx      Fiche véhicule production (rappels/plans/historique) (P8)
      facturation/
        page.tsx                  Liste factures, filtres statut (P9)
        [id]/page.tsx              Fiche + lignes/paiements/marge + actions (P9)
      dashboard/page.tsx           KPI CEO (CA, marge, panier moyen... + KPI CRM) (P9, étendu P10)
      techniciens/page.tsx         Liste lecture seule (P4)
      crm/
        page.tsx                  Dashboard CRM — segments, opérationnel, KPI CEO (P10)
        clients/
          page.tsx                Annuaire — recherche/filtre par segment (P10)
          [id]/page.tsx            Customer 360 (P10)
        follow-ups/page.tsx        Relances — liste + filtre statut (P10)
        care-plans/page.tsx        Catalogue CHICANO CARE (ADMIN/SUPER_ADMIN en écriture) (P10)
        campaigns/page.tsx         Campagnes — création/preview/envoi (ADMIN/SUPER_ADMIN) (P10)
    technicien/
      layout.tsx                   Garde RBAC (TECHNICIAN), dark mode (P5)
      page.tsx                     Mes interventions (liste des affectations)
      interventions/[assignmentId]/page.tsx  Détail + actions Je pars/Je suis arrivé/Démarrer diagnostic
      diagnostics/[diagnosticId]/page.tsx    Checklist + codes défaut + clôture
      reparations/
        page.tsx                  Mes réparations (liste des ordres affectés) (P7)
        [id]/page.tsx              Détail + actions technicien (P7)
    api/
      auth/
        register/route.ts
        login/route.ts
        logout/route.ts
        me/route.ts
        whatsapp/verify-code/route.ts
        whatsapp/resend-code/route.ts
      vehicles/
        route.ts                   GET (liste) / POST (création)
        [id]/route.ts              GET / PATCH
        [id]/set-primary/route.ts  POST
        [id]/archive/route.ts      POST
        [id]/photo/route.ts        POST (multipart, upload photo)
        [id]/history/route.ts      GET (client, ?category=&offset=&limit=) (P8)
        [id]/maintenance/route.ts  GET (client) (P8)
        [id]/reminders/route.ts    GET (client) (P8)
        [id]/mileage/route.ts      POST (client, jamais de régression forcée) (P8)
      service-requests/
        route.ts                   GET (liste mine) / POST (création)
        [id]/route.ts              GET / PATCH (édition restreinte, statut SUBMITTED uniquement)
        [id]/cancel/route.ts       POST (client)
        [id]/accept/route.ts       POST (RBAC production)
        [id]/reject/route.ts       POST (RBAC production)
        [id]/reschedule/route.ts   POST (RBAC production)
        [id]/attachments/route.ts  POST (multipart, photo/vidéo)
      appointments/
        route.ts                   GET (liste mine) — pas de POST, voir SERVICE-REQUESTS.md
        [id]/route.ts              GET
      production/service-requests/
        route.ts                   GET (toutes, filtres, RBAC)
        [id]/route.ts              GET (détail, RBAC)
      production/technicians/route.ts  GET (liste) (P4)
      production/service-requests/[id]/assign-technician/route.ts  POST (P4)
      service-requests/[id]/review/route.ts    POST — mise en examen (P4)
      service-requests/[id]/complete/route.ts  POST — clôture production (P4)
      production/diagnostics/[diagnosticId]/report/route.ts   POST — créer/récupérer le brouillon (P6)
      production/reports/[reportId]/route.ts                  PATCH — conclusion/sévérité (P6)
      production/reports/[reportId]/photos/route.ts           POST (multipart) (P6)
      production/reports/[reportId]/photos/[photoId]/route.ts DELETE (P6)
      production/reports/[reportId]/publish/route.ts          POST — figeage + notification (P6)
      production/diagnostics/[diagnosticId]/quote/route.ts    POST — créer un devis v1 (P6)
      production/quotes/[quoteId]/send/route.ts                POST — DRAFT → SENT (P6)
      production/quotes/[quoteId]/versions/route.ts            POST — nouvelle version (P6)
      quotes/[quoteId]/accept/route.ts                          POST (client) (P6)
      quotes/[quoteId]/reject/route.ts                          POST (client) (P6)
      quotes/[quoteId]/request-modification/route.ts           POST (client) (P6)
      technicien/
        interventions/[assignmentId]/depart/route.ts           POST — ASSIGNED → EN_ROUTE (P5)
        interventions/[assignmentId]/arrive/route.ts            POST — EN_ROUTE → ARRIVED (P5)
        interventions/[assignmentId]/start-diagnostic/route.ts  POST — crée le Diagnostic (P5)
        diagnostics/[diagnosticId]/checks/route.ts               POST — upsert DiagnosticCheck (P5)
        diagnostics/[diagnosticId]/fault-codes/route.ts          POST — ajoute un code défaut (P5)
        diagnostics/[diagnosticId]/fault-codes/[faultCodeId]/route.ts  DELETE (P5)
        diagnostics/[diagnosticId]/complete/route.ts             POST — clôt le diagnostic (P5)
        work-orders/route.ts                                     GET — mes ordres affectés (P7)
        work-orders/[id]/route.ts                                GET (P7)
        work-orders/[id]/start|pause|quality-check/route.ts      POST (P7)
        work-orders/[id]/missing-part/route.ts                   POST — pièce manquante + WAITING_PARTS (P7)
        work-orders/[id]/additional-work/route.ts                POST (P7)
        work-orders/[id]/items/[itemId]/route.ts                 PATCH — travail effectué (P7)
        work-orders/[id]/photos/route.ts                         POST (multipart, avant/après) (P7)
        vehicles/[id]/mileage/route.ts                            POST (P8)
      production/vehicles/[id]/mileage/route.ts                   POST — avec confirmed possible (P8)
      production/work-orders/route.ts                            GET (liste, filtres) (P7)
      production/work-orders/[id]/route.ts                       GET (détail) (P7)
      production/work-orders/[id]/schedule|assign-technician/route.ts       POST (P7)
      production/work-orders/[id]/start|pause|resume|waiting-parts/route.ts POST (P7)
      production/work-orders/[id]/quality-check/route.ts                    POST — envoi contrôle (P7)
      production/work-orders/[id]/quality-check/pass|fail/route.ts          POST (P7)
      production/work-orders/[id]/cancel|additional-work/route.ts           POST (P7)
      production/work-orders/[id]/parts/route.ts                           POST — ajouter une pièce (P7)
      production/work-orders/[id]/parts/[partId]/route.ts                  PATCH — statut pièce (P7)
      production/work-orders/[id]/items/[itemId]/route.ts                  PATCH (P7)
      production/work-orders/[id]/photos/route.ts                          POST (multipart) (P7)
      production/work-orders/[id]/workshop-transfer/route.ts               POST — embarquement (P7)
      production/work-orders/[id]/workshop-transfer/receive/route.ts       POST (P7)
      maintenance-plans/route.ts                                 POST (production) (P8)
      maintenance-plans/[id]/route.ts                            PATCH (production) (P8)
      maintenance-reminders/route.ts                             POST (production) (P8)
      maintenance-reminders/[id]/cancel/route.ts                 POST (production) (P8)
      maintenance-reminders/[id]/request-appointment/route.ts    POST (client) — crée une ServiceRequest (P8)
      production/maintenance/route.ts                            GET (?window=today|7d|30d|overdue) (P8)
      production/maintenance/check-reminders/route.ts            POST — déclenchement manuel (P8)
      production/billing/route.ts                                GET (liste, filtres) (P9)
      production/billing/[id]/route.ts                           GET / PATCH (charges, tant que DRAFT) (P9)
      production/billing/[id]/issue/route.ts                     POST — DRAFT → ISSUED (P9)
      production/billing/[id]/cancel/route.ts                    POST (P9)
      production/billing/[id]/payments/route.ts                  POST — toute méthode (P9)
      production/billing/check-overdue/route.ts                  POST — déclenchement manuel (P9)
      invoices/[id]/pay/route.ts                                  POST (client, Mobile Money uniquement) (P9)
      consent/route.ts                                            GET / PATCH (client, résolu depuis la session) (P10)
      production/crm/
        customers/route.ts                                        GET — annuaire (recherche/segment) (P10)
        customers/[id]/route.ts                                    GET — Customer 360 (P10)
        customers/[id]/consent/route.ts                             PATCH — consentement recueilli en production (P10)
        customers/[id]/interactions/route.ts                       GET / POST (P10)
        customers/[id]/care-subscriptions/route.ts                 GET / POST — proposer un plan (P10)
        care-subscriptions/[id]/route.ts                           PATCH — pause/reprise/résiliation (P10)
        care-plans/route.ts                                        GET / POST (création réservée ADMIN) (P10)
        care-plans/[id]/route.ts                                   PATCH (réservé ADMIN) (P10)
        care/check-expiring/route.ts                               POST — déclenchement manuel (P10)
        follow-ups/route.ts                                        GET / POST (P10)
        follow-ups/[id]/route.ts                                   PATCH — clôturer/annuler (P10)
        follow-ups/check-due/route.ts                              POST — déclenchement manuel (P10)
        campaigns/route.ts                                         GET / POST (création réservée ADMIN) (P10)
        campaigns/[id]/preview|send|cancel/route.ts                POST (réservé ADMIN) (P10)
        referrals/route.ts                                        GET / POST — préparatoire (P10)
  proxy.ts                          Garde d'accès (Node.js runtime, Next 16) — rôle sur /production, /technicien, /espace-client (P5)
  lib/
    db.ts                           Client Prisma singleton
    http.ts                         Helpers de réponse JSON (dont mapping d'erreurs métier → HTTP)
    phone.ts                        Normalisation E.164 (libphonenumber-js)
    auth/home-for-role.ts           Page d'accueil par rôle — source unique (login + proxy) (P5)
    validation/
      auth.ts                      Schémas zod auth
      vehicles.ts                  Schémas zod véhicule (création/mise à jour)
    auth/
      password.ts                   Hash/verify bcrypt
      otp.ts                        Génération/hash OTP + config
      session.ts                    Session JWT + révocation DB
    messaging/
      provider.ts                   Interface MessagingProvider
      whatsapp-provider.ts          Interface WhatsAppProvider
      get-provider.ts               Sélection mock/meta par env
      whatsapp-verification-service.ts  Service central OTP
      providers/
        mock-whatsapp-provider.ts
        meta-whatsapp-provider.ts
    vehicles/
      service.ts                    Couche de service (ownership systématique)
      service.test.ts               Tests unitaires (fake db en mémoire)
      guard.ts                      requireVerifiedCustomer() — garde des routes API
      guard.test.ts                 Tests unitaires (session mockée)
      vehicle-id.ts                 Génération CHC-VH-000001
      vehicle-id.test.ts
      options.ts                    Libellés/valeurs centralisés (carrosserie, carburant, boîte)
      history.ts                    Agrégation timeline (SR/rapport publié/WorkOrder terminé) (P8)
      history.test.ts
      mileage.ts                    MileageReading + garde anti-régression (P8)
      mileage.test.ts
      test-utils/fake-db.ts         Faux client Prisma minimal pour les tests (voir VEHICLES.md)
    storage/
      provider.ts                   Interface StorageProvider
      get-provider.ts               Sélection local/s3 par env
      providers/local-storage-provider.ts  Écrit réellement sous public/uploads
    service-requests/
      service.ts                    ServiceRequest + Appointment (accept crée l'Appointment)
      service.test.ts
      options.ts                    Libellés/valeurs + créneaux configurables (SERVICE_SLOTS)
      reference.ts                  Génération CHC-SR-000001
      test-utils/fake-db.ts         Fake db dédié (séparé de celui des véhicules, par prudence)
    appointments/
      service.ts                    Lecture seule (ownership) — pas de création directe
    notifications/
      service.ts                    NotificationService.send() — template + WhatsAppProvider existant
    maps/
      provider.ts                   Interface MapProvider
      get-provider.ts
      providers/openstreetmap-provider.ts  MVP sans dépendance ni clé API
    rbac.ts                          requireProductionRole() + requireAdminRole() (P10) — gardes routes/pages production
    rbac.test.ts
    technicians/
      service.ts                    Affectation (P4) + départ/arrivée/ownership (P5)
      service.test.ts
      guard.ts                       requireTechnician() (P5)
    diagnostics/
      service.ts                    Diagnostic + checklist + codes défaut (P5)
      service.test.ts
      options.ts                    Libellés catégories/résultats
    reports/
      service.ts                    DiagnosticReport + ReportPhoto (brouillon → publication figée) (P6)
      service.test.ts
      options.ts                    Libellés sévérité
      reference.ts                  Génération CHC-DR-000001 (P6)
    quotes/
      service.ts                    Quote + QuoteVersion + QuoteItem (cycle versionné) (P6)
      service.test.ts
      options.ts                    Libellés statut + formatXOF (F CFA)
      reference.ts                  Génération CHC-QT-000001 (P6)
    work-orders/
      service.ts                    WorkOrder + Item + Part + Photo (créé via acceptQuote()) (P7)
      service.test.ts
      options.ts                    Libellés statut/priorité/type/statut pièce
      reference.ts                  Génération CHC-WO-000001 (P7)
    maintenance/
      service.ts                    MaintenancePlan/MaintenanceReminder + niveaux + notifications (P8)
      service.test.ts
      options.ts                    Libellés type/statut/niveau
    billing/
      service.ts                    Invoice/InvoiceItem/Payment + marge (créé via passQualityCheck()) (P9)
      service.test.ts
      dashboard.ts                   KPI production/CEO (calculés depuis les données réelles)
      options.ts                    Libellés statut/type/méthode + formatXOF
      reference.ts                  Génération CHC-FAC/CHC-PAY/CHC-RC-000001
    payments/
      provider.ts                   Interface PaymentProvider (P9)
      get-provider.ts               Sélection manuel/Mobile Money par méthode
      providers/manual-payment-provider.ts     CASH/BANK_TRANSFER/OTHER — confirme immédiatement
      providers/mobile-money-provider.ts       Orange/Moov/Wave — NOT_CONFIGURED, jamais de faux paiement
    crm/
      config.ts                     Seuils de segmentation centralisés (P10)
      errors.ts                     Erreurs métier CRM (P10)
      segmentation.ts                6 segments + parcours client, calculés à la volée (P10)
      consent.ts                    Consentement opérationnel vs marketing (P10)
      customer360.ts                 Vue agrégée — réutilise chaque domaine existant (P10)
      interactions.ts                CustomerInteraction (P10)
      follow-ups.ts                  FollowUp (P10)
      campaigns.ts                    Campaign — preview/envoi, jamais de faux succès (P10)
      care.ts                         CarePlan/CareSubscription (P10)
      referrals.ts                    Referral — préparatoire uniquement (P10)
      directory.ts                    Annuaire CRM — recherche/segment (P10)
      dashboard.ts                     KPI CRM + KPI CEO croissance (P10)
      crm.test.ts                      Tests unitaires consolidés (40 tests) (P10)
  components/
    marketing/site-header.tsx, site-footer.tsx
    auth/logout-button.tsx
    vehicles/
      vehicle-card.tsx, vehicle-form.tsx, vehicle-actions.tsx, vehicle-photo-uploader.tsx
      vehicle-history-timeline.tsx  Timeline filtrable + pagination (client component) (P8)
    service-requests/
      service-request-wizard.tsx    Assistant 8 étapes (état local, un seul submit)
      service-request-card.tsx
      cancel-request-button.tsx
    production/
      service-request-actions.tsx   Accepter/Refuser/Demander autre créneau (client component)
      assign-technician-form.tsx    Formulaire d'affectation (P4)
      report-editor.tsx              Créer/éditer/publier le rapport (P6)
      quote-editor.tsx                Créer un devis, l'envoyer, émettre une v2 (P6)
      work-order-actions.tsx          Planifier/affecter/transitions/contrôle qualité (P7)
      work-order-item-maintenance-select.tsx  Rattache une ligne à une opération d'entretien (P8)
      invoice-actions.tsx              Émettre/annuler/enregistrer un paiement (P9)
      crm-actions.tsx                   Interaction/relance/abonnement Care — formulaires (P10)
      campaign-actions.tsx              Création/preview/envoi de campagne (P10)
      care-plan-form.tsx                Création/activation d'un plan CHICANO CARE (P10)
    technicien/
      intervention-actions.tsx      Je pars/Je suis arrivé/Démarrer le diagnostic (P5)
      diagnostic-checklist.tsx      10 catégories, upsert par ligne (P5)
      fault-codes-form.tsx          Ajout/retrait de codes défaut (P5)
      complete-diagnostic-button.tsx (P5)
      work-order-actions.tsx        Démarrer/pause/pièce manquante/contrôle/travaux suppl. (P7)
    quotes/
      quote-response-actions.tsx    Accepter/Refuser/Demander modification (client) (P6)
    maintenance/
      reminder-appointment-button.tsx  "Prendre rendez-vous" → ServiceRequest pré-remplie (P8)
    factures/
      pay-button.tsx                   Payer (Mobile Money) — jamais de faux succès (P9)
    account/
      consent-form.tsx                 Toggles préférences de communication (client) (P10)
prisma/
  schema.prisma                     Modèle de données complet (section 62) + extensions véhicule (P2) + demandes (P3) + sequenceNumber rapport/devis (P6) + Work Order refondu (P7) + carnet automobile étendu (P8) + facturation étendue (P9) + CRM/CHICANO CARE (P10)
  seed.ts                           Templates de notification (39) + compte admin de test + techniciens démo (P4, +4 templates P10)
  migrations/                       20260825001111_initial_schema, 20260825162443_service_requests, 20260826070000_diagnostic_report_quote_sequence (P6), 20260827100000_work_orders_phase7, 20260827100100_work_order_notifications (P7), 20260830000000_maintenance_type, 20260830000050_reminder_status, 20260830000100_maintenance_notifications (P8), 20260901000000_billing, 20260901000100_billing_notifications, 20260901000200_payment_method (P9), 20260902000000_crm_care, 20260902000100_crm_notifications (P10) — aucune nouvelle en P4/P5
vitest.config.mts                   Configuration des tests unitaires (npm test)
docker-compose.yml                  PostgreSQL local (port 5433) — non utilisé depuis P2.5, Neon en usage réel
```

### Positionnement de la Phase 10

```
Phase 8 — Maintenance / Carnet automobile numérique
        ↓ (historique + rappels, réutilisés tels quels)
Phase 9 — Facturation / Paiement
        ↓ (factures + marge, réutilisées telles quelles)
Phase 10 — CRM / Customer 360 / CHICANO CARE
```

**Le CRM oriente et rend visibles les domaines existants — il ne les
duplique jamais.** Customer 360 (`src/lib/crm/customer360.ts`) est un
agrégateur pur : chaque section (véhicules, demandes, rendez-vous, devis,
work orders, factures, entretien, rappels) est lue via la fonction
"ForCustomer"/"ForProduction" déjà construite dans son propre domaine
(Phases 2 à 9), jamais réinventée. Segmentation et parcours client sont
calculés à la volée, jamais stockés — même discipline que
`MaintenanceReminderLevel` (Phase 8). Détail complet dans
[`CRM.md`](CRM.md) et [`CHICANO-CARE.md`](CHICANO-CARE.md).

## 3. Fichiers existants conservés

Aucun code préexistant — projet neuf. Les documents de référence métier
(présentation, Business Model, Lean Canvas, logos) ont été déplacés tels quels dans
`docs/` sans modification.

## 4. Ce qui peut être conservé

Toute la base posée dans cette session (schéma Prisma, auth, abstraction WhatsApp,
design system Tailwind) est conçue pour être le socle des phases suivantes — rien
n'est un prototype jetable.

## 5. Ce qui doit être créé (prochaines phases)

Phases 3 à 10 (demandes de service, urgence, géolocalisation, rendez-vous,
dashboard production, technicien, diagnostic, rapport, devis, ordre de
travail, facturation, carnet numérique, rappels, CRM, CHICANO CARE) sont
désormais livrées — voir [`ROADMAP.md`](ROADMAP.md) pour le détail de
chaque phase. Reste à faire : B2B/flotte complet (préparé mais non
construit en Phase 10, voir `CRM.md`).

## 6. Architecture cible

Inchangée par rapport au choix initial : Next.js monolithique (frontend + API routes)
sur PostgreSQL/Prisma, avec abstraction de cartographie à construire en Phase 3
(Google Maps / Mapbox / OpenStreetMap interchangeables, non démarrée) et abstraction
de messagerie déjà en place et extensible à SMS/email transactionnel.

## 7. Schéma de base de données

Le schéma complet (`prisma/schema.prisma`) couvre l'intégralité du modèle minimum de
la section 62 : identité/accès, vérification WhatsApp, profils client/technicien,
entreprises/flottes, véhicules, demandes de service + localisation, rendez-vous +
affectation technicien, diagnostic (contrôles, codes défaut, rapport), devis +
versions + ordre de travail, pièces/stock, facturation/paiement, carnet
d'entretien/rappels, notifications (15 événements de la section 50), audit log.

Les tables **User, Session, WhatsappVerification, Customer, AuditLog** (Phase 1) et
**Vehicle, VehiclePhoto, MileageReading** (Phase 2, cette dernière posée mais pas
encore exploitée) sont câblées côté application. Le schéma Vehicle a été étendu en
Phase 2 : `sequenceNumber` (compteur natif Postgres), `bodyType`, `engine`,
`isPrimary`, `status`/`archivedAt` (archivage), enums `VehicleBodyType`/
`VehicleStatus`/`MileageSource`, transmission étendue (CVT, DCT) — détails dans
[`VEHICLES.md`](VEHICLES.md). Les autres tables existent en base dès la première
migration pour ne pas bloquer les phases suivantes sur des migrations tardives, mais
leur logique métier reste à construire phase par phase.

## 8. Flux WhatsApp OTP

```
Inscription (téléphone + mot de passe)
        ↓
Création User (status = PENDING_VERIFICATION) + session ouverte immédiatement
        ↓
WhatsAppVerificationService.sendVerificationCode()
        ↓ (cooldown 60s vérifié, code à 6 chiffres généré, hashé bcrypt, TTL 5 min)
Provider actif (mock en dev → log serveur uniquement / meta en prod → Cloud API)
        ↓
Écran « Vérifions votre numéro WhatsApp »
        ↓
verifyCode() : vérifie expiration, tentatives (max 5), compare le hash
        ↓ succès                              ↓ échec
User.status = VERIFIED                  attempts++, message d'erreur,
whatsappVerified = true                 nouveau code sur demande après cooldown
AuditLog « WHATSAPP_VERIFIED »
        ↓
Redirection /espace-client
```

Le code n'est **jamais** renvoyé dans une réponse HTTP ni affiché côté client — en
mode mock il n'apparaît que dans les logs serveur de développement.

## 9. Flux client (implémenté à ce stade)

```
Accueil → Créer mon compte → Vérification WhatsApp → Espace client
                                                    ↘ Connexion (comptes existants)
                                                    ↘ Mes véhicules → Ajouter/Modifier/
                                                      Fiche véhicule → Définir principal /
                                                      Archiver
```

L'espace client affiche « Bonjour {prénom} », le véhicule principal (ou un état vide
avec CTA « Ajouter un véhicule »), et les actions de la section 15 — « Mes véhicules »
est maintenant active, les autres (celles non encore construites) restent visibles
mais désactivées, pour ne pas exposer de liens morts.

## 10. Flux production

Non démarré (Phase 4). Le modèle de données est prêt (Appointment, statuts complets
de la section 26, TechnicianAssignment).

## 11. Flux technicien

Non démarré (Phase 5). Modèle Diagnostic/DiagnosticCheck/DiagnosticFaultCode prêt.

## 12. Roadmap de développement

Voir [`ROADMAP.md`](ROADMAP.md).
