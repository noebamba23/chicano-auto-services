# CHICANO AUTO SERVICES — Plateforme

Plateforme digitale de diagnostic, maintenance, réparation, assistance et gestion
automobile pour CHICANO AUTO SERVICES (Bamako, Mali).

> **Nous diagnostiquons avant de réparer.**
> Diagnostic → Preuve → Rapport → Devis → Validation client → Réparation → Traçabilité.

## Stack

- **Frontend / Backend** : Next.js 16 (App Router) + TypeScript, une seule codebase.
- **UI** : Tailwind CSS v4.
- **Base de données** : PostgreSQL via Prisma ORM (v6 — la v7 introduit une refonte de
  configuration `prisma.config.ts` encore instable, volontairement évitée pour ce MVP).
- **Auth** : session maison (cookie httpOnly signé JWT via `jose`) + mots de passe
  hashés `bcryptjs`. Distincte de la vérification WhatsApp (cf. section 13 du cahier
  des charges).
- **WhatsApp** : abstraction `MessagingProvider` / `WhatsAppProvider`
  (`src/lib/messaging`) avec deux implémentations : `mock` (développement, code
  journalisé serveur) et `meta` (Meta WhatsApp Business Cloud API, à activer en
  configurant les variables d'environnement `WHATSAPP_META_*`).

## Démarrage local

```bash
npm install
docker compose up -d        # Postgres local sur le port 5433
cp .env.example .env        # si pas déjà fait
npm run db:migrate          # applique le schéma Prisma
npm run db:seed             # templates de notification + compte super admin de test
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Compte de test créé par le seed : `+22370000001` / `ChangeMe123!` (à changer avant
toute mise en production).

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run start` | Build et exécution production |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Migration Prisma (dev) |
| `npm run db:studio` | Interface d'exploration de la base |
| `npm run db:seed` | Données de démarrage |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — audit, architecture cible, flux
  WhatsApp OTP, flux client/production/technicien.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — état d'avancement par phase (P0 → P10).
- Documents de cadrage métier d'origine : `docs/CHICANO_AUTO_SERVICES_Business_Model_v0.1.docx`,
  `docs/CHICANO AUTO SERVICES Presentation.pdf`, `docs/LEAN CANVAS.docx`.

## Sécurité — rappels

- Le code OTP n'est **jamais** renvoyé dans une réponse HTTP, ni affiché côté client.
  En mode `mock`, il n'est journalisé que dans les logs serveur (dev uniquement).
- `SESSION_SECRET`, `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_APP_SECRET` sont des
  secrets — ne jamais les committer (`.env` est ignoré par git, seul `.env.example`
  est versionné).
- Un client ne doit jamais pouvoir consulter les données d'un autre client — toute
  nouvelle route API doit filtrer par `session.sub` / rôle.
