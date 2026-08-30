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
      techniciens/page.tsx         Liste lecture seule (P4)
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
    rbac.ts                          requireProductionRole() — garde des routes/pages production
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
  components/
    marketing/site-header.tsx, site-footer.tsx
    auth/logout-button.tsx
    vehicles/
      vehicle-card.tsx, vehicle-form.tsx, vehicle-actions.tsx, vehicle-photo-uploader.tsx
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
    technicien/
      intervention-actions.tsx      Je pars/Je suis arrivé/Démarrer le diagnostic (P5)
      diagnostic-checklist.tsx      10 catégories, upsert par ligne (P5)
      fault-codes-form.tsx          Ajout/retrait de codes défaut (P5)
      complete-diagnostic-button.tsx (P5)
      work-order-actions.tsx        Démarrer/pause/pièce manquante/contrôle/travaux suppl. (P7)
    quotes/
      quote-response-actions.tsx    Accepter/Refuser/Demander modification (client) (P6)
prisma/
  schema.prisma                     Modèle de données complet (section 62) + extensions véhicule (P2) + demandes (P3) + sequenceNumber rapport/devis (P6) + Work Order refondu (P7)
  seed.ts                           Templates de notification (27) + compte admin de test + techniciens démo (P4)
  migrations/                       20260825001111_initial_schema, 20260825162443_service_requests, 20260826070000_diagnostic_report_quote_sequence (P6), 20260827100000_work_orders_phase7, 20260827100100_work_order_notifications (P7) — aucune nouvelle en P4/P5
vitest.config.mts                   Configuration des tests unitaires (npm test)
docker-compose.yml                  PostgreSQL local (port 5433) — non utilisé depuis P2.5, Neon en usage réel
```

## 3. Fichiers existants conservés

Aucun code préexistant — projet neuf. Les documents de référence métier
(présentation, Business Model, Lean Canvas, logos) ont été déplacés tels quels dans
`docs/` sans modification.

## 4. Ce qui peut être conservé

Toute la base posée dans cette session (schéma Prisma, auth, abstraction WhatsApp,
design system Tailwind) est conçue pour être le socle des phases suivantes — rien
n'est un prototype jetable.

## 5. Ce qui doit être créé (prochaines phases)

Voir [`ROADMAP.md`](ROADMAP.md) — phases 3 à 10 non démarrées : demandes de service,
urgence, géolocalisation, rendez-vous, dashboard production, technicien, diagnostic,
rapport, devis, ordre de travail, facturation, carnet numérique, rappels, CRM,
B2B/flotte.

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
