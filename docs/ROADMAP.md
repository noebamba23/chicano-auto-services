# Roadmap — CHICANO AUTO SERVICES Platform

Suivi par phase, dans l'ordre imposé par la section 70 du cahier des charges.
Ne pas paralléliser les phases : chacune se construit sur la précédente.

| Phase | Contenu | Statut |
| --- | --- | --- |
| P0 | Audit + architecture | ✅ Fait — voir `ARCHITECTURE.md` |
| P1 | Auth + vérification WhatsApp | ✅ Fait — inscription, OTP (mock/meta), connexion, session, garde d'accès, audit log |
| P2 | Client + véhicules | ⏳ À faire — CRUD véhicule, `CHC-VH-000001`, upload photo |
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

## Non couvert par la Phase 1 (volontairement)

- Ajout de véhicule, demande de service, urgence, rendez-vous, dashboard production,
  diagnostic, rapport, devis, facturation, CRM, B2B — chacun sera livré dans sa
  propre phase, sur le schéma déjà posé.
- Envoi WhatsApp réel : le fournisseur `meta` est implémenté mais nécessite un compte
  Meta WhatsApp Business Platform configuré (`WHATSAPP_META_ACCESS_TOKEN`,
  `WHATSAPP_META_PHONE_NUMBER_ID`) — non activé par défaut.

## Blocage connu à ce jour

Docker Desktop n'a pas terminé son initialisation sur cette machine au moment de ce
chantier (le moteur ne répond pas après plusieurs minutes — probablement une étape
de premier lancement nécessitant une interaction manuelle, ex. acceptation des
conditions d'utilisation ou mise à jour du noyau WSL2). La migration Prisma
(`npm run db:migrate`) n'a donc pas pu être exécutée dans cette session. Le schéma a
été validé (`prisma validate`) et le client généré (`prisma generate`) ; il ne reste
qu'à lancer `docker compose up -d` une fois Docker opérationnel, puis
`npm run db:migrate && npm run db:seed`.
