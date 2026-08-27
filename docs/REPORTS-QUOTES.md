# Rapport de diagnostic & devis versionné — Phase 6

Suite de `TECHNICIAN-APP.md` (Phase 5 — diagnostic terrain). Cette phase
construit le rapport client formaté (preuve publiée, photos) et le cycle de
devis versionné (négociation client ↔ production), en s'appuyant sur les
données du diagnostic. S'arrête avant `WorkOrder` — voir "Non couvert".

## Migration Phase 6

Seule migration nécessaire depuis la Phase 3 : ajout de
`sequenceNumber Int @unique @default(autoincrement())` sur `DiagnosticReport`
et `Quote` (absent du schéma initial, contrairement à `Vehicle`/
`ServiceRequest`), pour générer des références lisibles `CHC-DR-000001` /
`CHC-QT-000001` selon le même mécanisme que les phases précédentes (compteur
natif Postgres, jamais la clé primaire). `prisma migrate dev` refusant de
tourner en environnement non interactif (déjà rencontré en Phase 3), la
migration a été écrite à la main
(`prisma/migrations/20260826070000_diagnostic_report_quote_sequence/`) puis
appliquée via `prisma migrate deploy` (non interactif, sans risque : les deux
tables étaient vides, aucune perte de données possible).

## Rapport de diagnostic

- Créable uniquement une fois `Diagnostic.status = COMPLETED`
  (`getOrCreateDraftReport()`, idempotent).
- Brouillon (`publishedAt = null`) : conclusion, sévérité, photos de preuve
  (upload réel via `StorageProvider`, même mécanisme que les photos véhicule
  de la Phase 2) — modifiable librement par la production.
- **Publication = figeage définitif.** Une fois `publishedAt` posé, plus
  aucune modification n'est possible (`ReportConflictError`) — le client doit
  pouvoir se fier au rapport qu'il consulte, jamais un contenu qui change
  après coup (section "preuve" de la philosophie CHICANO : diagnostiquer
  avant de réparer).
- Un brouillon n'est **jamais** exposé côté client — seul un rapport publié
  apparaît dans `/espace-client/rapports`. Ownership vérifiée via
  `diagnostic.vehicle.customerId` (404, jamais 403, même discipline que le
  reste de la plateforme).
- Notification `REPORT_AVAILABLE` envoyée au client à la publication
  (template déjà seedé depuis la Phase 3, réutilisé sans modification).

## Devis versionné

Cycle d'états (`QuoteStatus`) :

```
DRAFT --(production envoie)--> SENT --(client accepte)--> ACCEPTED
                                 |--(client refuse)------> REJECTED
                                 |--(client demande une
                                     modification)-------> MODIFICATION_REQUESTED
                                                                |
                                          (production émet une v2) 
                                                                v
                                                              SENT (v2)
```

- Un devis n'est créable que sur un diagnostic `COMPLETED` (même garde que le
  rapport). `createQuote()` est idempotent tant qu'un devis **actif**
  (DRAFT/SENT/MODIFICATION_REQUESTED) existe déjà pour ce diagnostic — un
  nouveau devis n'est possible qu'après un devis clos (ACCEPTED/REJECTED),
  cas légitime d'un second essai après refus.
- **Aucune édition en place d'une version envoyée.** Une demande de
  modification client crée toujours une `QuoteVersion` supplémentaire
  (`createQuoteVersion()`, uniquement depuis `MODIFICATION_REQUESTED`) —
  l'historique de négociation reste visible en entier, jamais réécrit.
- Un devis `DRAFT` (pas encore envoyé) est invisible côté client, même
  discipline que le rapport en brouillon.
- Notifications réutilisées sans modification : `QUOTE_AVAILABLE` (envoi
  initial et chaque nouvelle version), `QUOTE_ACCEPTED` (acceptation). Aucune
  notification pour un refus ou une demande de modification — signal interne
  visible côté production (fiche demande), pas un événement WhatsApp
  (cohérent avec le reste de la plateforme : la soumission initiale d'une
  demande de service ne notifie pas non plus la production par WhatsApp,
  seulement par visibilité dans le Control Center).
- Le motif de refus et la note de demande de modification sont journalisés
  dans `AuditLog` (même mécanisme que le motif de refus d'une demande de
  service en Phase 3) mais pas encore affichés dans l'UI production — la
  conversation continue par téléphone/WhatsApp comme pour le reste du
  parcours métier.

## Interface production

`/production/demandes/[id]` — deux nouvelles sections, visibles uniquement
une fois le diagnostic terminé : "Rapport de diagnostic"
(`ReportEditor` — créer/éditer/publier) et "Devis" (`QuoteEditor` — créer une
première version en construisant les lignes, envoyer, émettre une nouvelle
version après demande de modification). Même principe que les Phases 4/5 :
tout reste sur une seule fiche demande, pas de fragmentation en multiples
URLs de production.

## Interface client

- `/espace-client/rapports` (liste, publiés uniquement) et
  `/espace-client/rapports/[id]` (détail : conclusion, sévérité, photos,
  points de contrôle).
- `/espace-client/devis` (liste, hors DRAFT) et `/espace-client/devis/[id]`
  (détail : lignes, main d'œuvre, déplacement, délai, total ; actions
  Accepter / Refuser / Demander une modification, visibles uniquement au
  statut `SENT`).
- Les deux entrées "Mes rapports"/"Mes devis" du tableau de bord client
  (posées en placeholder `available: false` depuis la Phase 1) sont
  désormais actives.

## Tests

18 nouveaux tests unitaires (104 au total) :
- `src/lib/reports/service.test.ts` — création (garde COMPLETED,
  idempotence), édition/publication (figeage), visibilité client (ownership,
  brouillon invisible).
- `src/lib/quotes/service.test.ts` — création (total calculé, idempotence),
  cycle accepter/refuser, cycle de renégociation (versions), ownership,
  nouveau devis après refus.

Le fake db partagé (`src/lib/service-requests/test-utils/fake-db.ts`) a été
étendu une 5ᵉ fois : modèles `diagnosticReport`/`reportPhoto`/`quote`/
`quoteVersion`/`quoteItem`, plus le raccourci Prisma `{ in: [...] }` ajouté au
matcher générique (nécessaire pour la recherche d'un devis actif parmi
plusieurs statuts). Même limite documentée dans les phases précédentes : ces
tests couvrent la logique applicative, pas la forme d'affichage complète ni
PostgreSQL réel — validé séparément contre Neon + navigateur (voir rapport de
Phase 6).

## Non couvert par la Phase 6 (volontairement)

- **`WorkOrder`** (ordre de travail, création automatique à l'acceptation
  d'un devis) — Phase 7 ("Validation + réparation + clôture"). Un devis
  `ACCEPTED` ne déclenche aujourd'hui aucune action de réparation.
- Facturation, carnet d'entretien, rappels — phases ultérieures.
- Expiration automatique des devis (`QuoteStatus.EXPIRED` posé au schéma,
  jamais déclenché — nécessiterait une tâche planifiée, hors périmètre).
- Affichage du motif de refus / de la note de modification côté UI
  production (journalisé en base, non exposé à l'écran).
- Réaffectation d'un devis/rapport si le diagnostic change de technicien
  propriétaire après coup (même limite déjà documentée pour le diagnostic en
  Phase 5).
