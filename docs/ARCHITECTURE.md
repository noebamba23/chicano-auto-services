# CHICANO AUTO SERVICES — Architecture (Phase 0 + Phase 1 + Phase 2)

Ce document répond aux points 1 à 11 de la section 71 du cahier des charges
(« Première étape — avant de coder ») pour l'état actuel du projet. Le détail
spécifique à la gestion des véhicules (Phase 2) est dans [`VEHICLES.md`](VEHICLES.md).

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
  maturation de la v7).
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
      demande-service/page.tsx    Route réelle (ownership vérifiée) pour Diagnostic/Entretien, préparée pour la Phase 3
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
  proxy.ts                          Garde d'accès (Node.js runtime, Next 16)
  lib/
    db.ts                           Client Prisma singleton
    http.ts                         Helpers de réponse JSON (dont mapping d'erreurs métier → HTTP)
    phone.ts                        Normalisation E.164 (libphonenumber-js)
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
  components/
    marketing/site-header.tsx, site-footer.tsx
    auth/logout-button.tsx
    vehicles/
      vehicle-card.tsx, vehicle-form.tsx, vehicle-actions.tsx, vehicle-photo-uploader.tsx
prisma/
  schema.prisma                     Modèle de données complet (section 62) + extensions véhicule (Phase 2)
  seed.ts                           Templates de notification + compte admin de test
vitest.config.mts                   Configuration des tests unitaires (npm test)
docker-compose.yml                  PostgreSQL local (port 5433)
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
