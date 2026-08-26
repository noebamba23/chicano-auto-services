# Espace technicien & diagnostic — Phase 5

Suite de `SERVICE-REQUESTS.md` (Phase 3 — demande/rendez-vous) et de sa
section Phase 4 (Kanban/calendrier/affectation basique). Cette phase livre
l'espace technicien complet (départ/arrivée sur site) et le module de
diagnostic terrain (checklist + codes défaut). Elle ne livre PAS le rapport
client formaté ni le devis — voir "Non couvert" en bas de page.

## Architecture — trois statuts, trois granularités

- `ServiceRequest.status` — reste grossier (ACCEPTED jusqu'à COMPLETED via la
  production, section Phase 4). Cette phase ne le touche pas.
- `Appointment.status` — devient réellement granulaire : `ASSIGNED` →
  `TECHNICIAN_EN_ROUTE` → `ARRIVED` → `IN_PROGRESS`. Ces valeurs existaient
  dans le schéma depuis la Phase 0 mais n'étaient pas encore pilotées.
  `COMPLETED` sur l'Appointment reste exclusivement déclenché par
  `completeServiceRequest()` (action production "Marquer terminée",
  Phase 4) — un diagnostic terminé ne clôt PAS l'Appointment (voir plus bas).
- `TechnicianAssignment.status` — suit le fil terrain du technicien lui-même :
  `ASSIGNED` → `EN_ROUTE` → `ARRIVED` → `COMPLETED` (posé à la clôture du
  diagnostic). `REASSIGNED` reste réservé à l'historique (Phase 4).

Ces trois champs ne sont jamais fusionnés : un technicien peut clôturer son
diagnostic sans que la demande soit administrativement terminée (réparation,
devis, facturation restent à faire dans des phases ultérieures).

## Rôle TECHNICIAN — accès et redirection

Avant cette phase, tous les rôles atterrissaient sur `/espace-client` après
connexion (même un compte production ou technicien) — l'espace client se
contentait d'un tableau de bord vide pour un non-client, sans blocage
explicite. Corrigé ici avec `src/lib/auth/home-for-role.ts`, source unique
utilisée à la fois par la redirection post-connexion
(`src/app/api/auth/login/route.ts`) et par le garde `src/proxy.ts` :

- `CUSTOMER` → `/espace-client`
- `TECHNICIAN` → `/technicien`
- `PRODUCTION_STAFF` / `ADMIN` / `SUPER_ADMIN` → `/production/demandes`

`src/proxy.ts` bloque désormais chaque espace pour les rôles qui n'y ont pas
accès (auparavant, seul `/production` était filtré par rôle ; `/espace-client`
était atteignable par n'importe quel compte authentifié). `requireTechnician()`
(`src/lib/technicians/guard.ts`) fait le même travail côté API que
`requireProductionRole()`/`requireVerifiedCustomer()` : authentification +
rôle + résolution de l'identité métier (`technicianId`).

## Ownership technicien

Un technicien ne voit et n'agit que sur SES propres affectations — même
discipline "404 plutôt que 403" que le reste de la plateforme (une
affectation d'un autre technicien, ou marquée `REASSIGNED`, se comporte comme
inexistante). `getAssignmentForTechnician()` centralise ce filtre ;
`getDiagnosticForTechnician()` fait de même via `Diagnostic.technicianId`
(fixé à la création, ne change pas si l'affectation est réaffectée en cours
de diagnostic — voir "Non couvert").

## Espace technicien (`/technicien`)

- `/technicien` — tableau de bord : liste des affectations non `REASSIGNED`
  (y compris `COMPLETED`, pour garder un historique simple sans page dédiée).
- `/technicien/interventions/[assignmentId]` — détail + actions contextuelles
  selon le statut de l'affectation :
  - `ASSIGNED` → bouton "Je pars" (`POST .../depart`, ASSIGNED → EN_ROUTE,
    notifie `TECHNICIAN_EN_ROUTE`).
  - `EN_ROUTE` → bouton "Je suis arrivé" (`POST .../arrive`, EN_ROUTE →
    ARRIVED, notifie `TECHNICIAN_ARRIVED`).
  - `ARRIVED` sans diagnostic → formulaire kilométrage/symptômes +
    "Démarrer le diagnostic" (`POST .../start-diagnostic`, crée le
    `Diagnostic`, Appointment → `IN_PROGRESS`). Idempotent : un second appel
    retourne le diagnostic déjà créé plutôt que d'en dupliquer un.
  - `ARRIVED` avec diagnostic déjà démarré → lien "Continuer le diagnostic".
  - `COMPLETED` → lien "Revoir le diagnostic" (lecture seule).
- `/technicien/diagnostics/[diagnosticId]` — checklist (10 catégories,
  résultat + observation, `DiagnosticCheck` avec upsert par catégorie), codes
  défaut (ajout/retrait libres, `DiagnosticFaultCode`), bouton "Terminer le
  diagnostic". Passe en lecture seule dès que le diagnostic est `COMPLETED`.

## Notifications

Réutilise les événements déjà posés en Phase 0/3 (`TECHNICIAN_EN_ROUTE`,
`TECHNICIAN_ARRIVED`, `DIAGNOSTIC_COMPLETED`) et déjà seedés avec un
template — aucun nouveau `NotificationEvent` nécessaire.

## Visibilité production

`/production/demandes/[id]` affiche désormais une section "Diagnostic" en
lecture seule (aucune action) : statut, kilométrage/symptômes, nombre de
points de contrôle vérifiés et leur résultat, nombre de codes défaut. Utilise
`getLatestDiagnosticForAppointment()` — pas d'ownership (RBAC déjà géré par
`requireProductionRole()`/le garde de page).

## Tests

19 nouveaux tests unitaires (92 au total) :
- `src/lib/technicians/service.test.ts` — départ/arrivée, transitions
  invalides, ownership.
- `src/lib/diagnostics/service.test.ts` — démarrage (y compris idempotence et
  refus avant ARRIVED), checklist (upsert), codes défaut (ajout/retrait),
  clôture (statut + clôture de l'affectation), verrouillage après clôture,
  ownership.

Même limite documentée pour `src/lib/vehicles/test-utils/fake-db.ts` et
`src/lib/service-requests/test-utils/fake-db.ts` : ces tests couvrent la
logique applicative, pas la forme d'affichage complète ni PostgreSQL réel —
validé séparément contre Neon + navigateur (voir rapport de Phase 5).

## Non couvert par la Phase 5 (volontairement)

- **Rapport de diagnostic formaté et photos de preuve**
  (`DiagnosticReport`/`ReportPhoto`, déjà posés au schéma) — Phase 6
  ("Rapport + devis"), qui s'appuiera sur les données capturées ici.
- **Devis, réparation, validation client, facturation** — Phases 6/7.
- Un diagnostic `COMPLETED` ne clôt PAS `Appointment.status` (qui reste
  `IN_PROGRESS`) — la clôture complète de l'intervention appartient aux
  phases suivantes. Seule l'action production "Marquer terminée" (Phase 4)
  peut faire passer `ServiceRequest`/`Appointment` à `COMPLETED`,
  indépendamment de l'avancement du diagnostic.
- Réaffectation d'un technicien en cours de diagnostic : `Diagnostic` reste
  attaché au technicien qui l'a démarré. Un nouveau technicien affecté après
  coup ne peut pas reprendre ce diagnostic (edge case jugé rare, non traité).
- Géolocalisation temps réel du technicien en déplacement (le statut
  `EN_ROUTE` est déclaratif, pas suivi sur carte).
- Vue calendrier/historique dédiée au technicien au-delà de la liste simple
  de `/technicien`.
