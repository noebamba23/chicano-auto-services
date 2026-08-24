# CHICANO AUTO SERVICES — Architecture (Phase 0 + Phase 1)

Ce document répond aux points 1 à 11 de la section 71 du cahier des charges
(« Première étape — avant de coder ») pour l'état actuel du projet.

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
      page.tsx                     Tableau de bord client (Bonjour {prénom}...)
    api/auth/
      register/route.ts
      login/route.ts
      logout/route.ts
      me/route.ts
      whatsapp/verify-code/route.ts
      whatsapp/resend-code/route.ts
  proxy.ts                          Garde d'accès (Node.js runtime, Next 16)
  lib/
    db.ts                           Client Prisma singleton
    http.ts                         Helpers de réponse JSON
    phone.ts                        Normalisation E.164 (libphonenumber-js)
    validation/auth.ts              Schémas zod
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
  components/
    marketing/site-header.tsx, site-footer.tsx
    auth/logout-button.tsx
prisma/
  schema.prisma                     Modèle de données complet (section 62)
  seed.ts                           Templates de notification + compte admin de test
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

Voir [`ROADMAP.md`](ROADMAP.md) — phases 2 à 10 non démarrées : véhicules, demandes
de service, urgence, géolocalisation, rendez-vous, dashboard production, technicien,
diagnostic, rapport, devis, ordre de travail, facturation, carnet numérique, rappels,
CRM, B2B/flotte.

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

Seules les tables **User, Session, WhatsappVerification, Customer, AuditLog** sont
aujourd'hui câblées côté application (Phase 1). Les autres tables existent en base
dès la première migration pour ne pas bloquer les phases suivantes sur des
migrations tardives, mais leur logique métier reste à construire phase par phase.

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
```

L'espace client affiche « Bonjour {prénom} », un état vide pour le véhicule
principal, et les actions de la section 15 (celles non encore construites sont
visibles mais désactivées, pour ne pas exposer de liens morts).

## 10. Flux production

Non démarré (Phase 4). Le modèle de données est prêt (Appointment, statuts complets
de la section 26, TechnicianAssignment).

## 11. Flux technicien

Non démarré (Phase 5). Modèle Diagnostic/DiagnosticCheck/DiagnosticFaultCode prêt.

## 12. Roadmap de développement

Voir [`ROADMAP.md`](ROADMAP.md).
