# Carnet automobile numérique (Phase 8) — historique, entretien, rappels

## Vision

Le dossier véhicule CHICANO devient un carnet automobile numérique : le
client retrouve au même endroit l'identité du véhicule, son immatriculation,
son kilométrage, l'historique de ses diagnostics/rapports/devis/réparations/
entretiens, et ses rappels à venir.

## Règle fondamentale — pas de deuxième historique

L'historique n'est **jamais** une table de données dupliquées. Il est
construit à la volée en agrégeant les événements métier déjà existants
(`ServiceRequest`, `DiagnosticReport` publié, `WorkOrder` terminé) — voir
[`src/lib/vehicles/history.ts`](../src/lib/vehicles/history.ts). Ajouter une
nouvelle source d'événements métier l'ajoute automatiquement à la timeline,
sans nouvelle table.

## Placeholder existant

`MaintenancePlan`/`MaintenanceReminder` étaient posés en Phase 0, jamais
exploités (confirmés vides sur Neon avant modification) — étendus plutôt que
remplacés. `MileageReading` (Phase 2, jamais exploité) sert de source pour
l'historique du kilométrage.

## Historique véhicule

`getVehicleHistory(vehicleId)` fusionne trois sources (plafonnées à 50
chacune avant fusion, pour ne jamais charger un historique sans limite) :

- `ServiceRequest` (hors DRAFT/CANCELLED) → catégorie `OTHER`.
- `DiagnosticReport` **publié uniquement** (jamais un brouillon) → catégorie
  `DIAGNOSTIC`.
- `WorkOrder` **`COMPLETED` uniquement** → catégorie `REPAIR`, `MAINTENANCE`
  ou `TECHNICAL_VISIT` selon que ses lignes (`WorkOrderItem.maintenanceType`)
  sont rattachées ou non à une opération d'entretien.

Résultat trié par date décroissante, paginé en mémoire (`limit`/`offset`,
défaut 20). `getVehicleHistoryForCustomer()` ajoute l'ownership (404 si le
véhicule n'appartient pas au client).

Pour les véhicules déjà présents sans historique réel : jamais d'invention,
l'état vide affiche explicitement *"Pas encore d'historique disponible."*

## Kilométrage

`Vehicle.mileage` reste le relevé courant ; `MileageReading` conserve
l'historique complet. `recordMileageReading()` refuse toute valeur
inférieure au dernier relevé connu (`MileageRegressionError`) **sauf**
confirmation explicite (`confirmed: true`) — jamais implicite, toujours
audité avec l'ancienne et la nouvelle valeur.

- **Client** (`recordMileageReadingForCustomer`) : jamais de champ
  `confirmed` exposé — une régression est toujours bloquée.
- **Production/technicien** : peuvent forcer une correction explicite
  (erreur de saisie antérieure).

## MaintenancePlan

Un plan reste rattaché à **un seul véhicule** — volontairement pas de liste
universelle imposée par marque/modèle (aucune source constructeur vérifiée
disponible pour ce projet). `MaintenanceType` a été étendu (16 valeurs :
vidange, filtres séparés, freins, liquide de frein, pneus, batterie,
climatisation, courroie, bougies, transmission, liquide de refroidissement,
visite technique, entretien périodique, autre) mais reste indépendant du
type de motorisation — `Vehicle.fuelType` (déjà existant : ESSENCE/DIESEL/
HYBRID/PLUGIN_HYBRID/ELECTRIC/OTHER) suffit à préparer l'extensibilité
ICE/Hybride/Électrique demandée, sans construire de système spécialisé
(diagnostic batterie haute tension, etc. — hors périmètre de cette phase).

Un plan a une priorité (réutilise `WorkOrderPriority`) et un statut
actif/inactif (`isActive`).

## MaintenanceReminder

Statuts : `PENDING`, `SCHEDULED`, `SENT`, `COMPLETED`, `CANCELLED`. Un
rappel doit avoir au moins une échéance (date **ou** kilométrage, ou les
deux). Le premier seuil atteint déclenche le niveau d'alerte —
`computeReminderLevel()` retourne le plus urgent des deux si les deux sont
définis.

## Niveaux d'alerte progressifs

`UPCOMING` / `DUE` / `OVERDUE` (3 niveaux, volontairement pas plus) —
calculés à la volée depuis `dueAt`/`dueMileage`, jamais stockés comme source
de vérité. Seuils opérationnels par défaut (réglage applicatif, **pas une
donnée constructeur vérifiée**) :

| | Date | Kilométrage |
| --- | --- | --- |
| UPCOMING | ≤ 30 jours | ≤ 500 km |
| DUE | ≤ 7 jours | ≤ 100 km |
| OVERDUE | dépassé | dépassé |

Anti-spam : `lastNotifiedLevel`/`lastNotifiedAt` sur le rappel — un niveau
n'est jamais renotifié tant qu'il n'a pas progressé.

## Déclenchement des notifications

`checkAndNotifyReminders()` scanne les rappels actifs, calcule le niveau,
notifie en cas de progression. **Aucun scheduler/cron n'existe dans ce
projet** — exposé via `POST /api/production/maintenance/check-reminders`
(déclenchement manuel par la production). Une automatisation réelle
(cron/tâche planifiée) reste à construire dans une phase ultérieure — limite
assumée, jamais présentée comme active.

3 événements `NotificationEvent` ajoutés : `MAINTENANCE_UPCOMING`,
`MAINTENANCE_DUE`, `MAINTENANCE_OVERDUE`. `REPAIR_COMPLETED`/`VEHICLE_READY`
(déjà posés en Phase 0) sont réutilisés pour un entretien terminé — pas de
nouvel événement `SERVICE_COMPLETED`. L'ancien `MAINTENANCE_REMINDER`
générique reste dans l'enum (template déjà seedé) mais n'est plus utilisé
par le nouveau code.

## Entretien réalisé — uniquement depuis un Work Order terminé

Un entretien n'est **jamais** déclaré réalisé par le client.
`completeMaintenanceFromWorkOrder()` est appelée uniquement depuis
[`work-orders/service.ts::passQualityCheck()`](../src/lib/work-orders/service.ts)
— jamais ailleurs. Pour chaque `WorkOrderItem.maintenanceType` renseigné :

1. Les rappels actifs correspondants (même véhicule, même type) passent à
   `COMPLETED`, avec `completedByWorkOrderId` pour traçabilité.
2. Le `MaintenancePlan` actif correspondant voit `lastDoneAt`/
   `lastDoneMileage` mis à jour.
3. La prochaine échéance est calculée (`lastDoneAt + intervalMonths` et/ou
   `lastDoneMileage + intervalKm`) et un nouveau `MaintenanceReminder`
   `SCHEDULED` est créé automatiquement.

**Rattachement d'une ligne à un entretien** : la production tague une ligne
de travaux (`WorkOrderItem`) avec un `MaintenanceType` depuis la fiche Work
Order (menu déroulant) — c'est ce rattachement qui déclenche tout le
mécanisme ci-dessus. Sans rattachement, un Work Order terminé alimente
l'historique comme une simple réparation, sans toucher au carnet
d'entretien.

## Rappel → ServiceRequest

Le bouton "Prendre rendez-vous" (`POST /api/maintenance-reminders/[id]/request-appointment`)
réutilise `createServiceRequest()` existant — véhicule et service
pré-remplis, **jamais** un `Appointment` confirmé créé directement. Le
workflow standard (demande → étude production → acceptation → rendez-vous)
reste inchangé.

## Permissions

- **Client** : lecture seule de son historique/entretien/rappels
  (ownership 404), peut enregistrer un relevé kilométrique (jamais de
  régression forcée), peut déclencher "Prendre rendez-vous".
- **Technicien** : peut enregistrer un relevé kilométrique (avec
  confirmation possible), ne peut jamais modifier un événement historique
  déjà réalisé (les sources — WorkOrder terminé, rapport publié — sont déjà
  immuables par construction, voir Phases 6/7).
- **Production/Admin** : créer/modifier/désactiver un plan, créer/annuler un
  rappel, déclencher la vérification des notifications, voir historique/
  entretien/rappels de n'importe quel véhicule (jamais une vue croisée
  entre clients — chaque lecture reste scopée à UN véhicule).

Toutes les modifications (plans, rappels) sont auditées via `AuditLog`
existant — pas de nouvelle table d'historique dédiée.

## Fiche véhicule côté production

`/production/vehicules/[id]` — nouvelle page (aucune ownership client, déjà
gardée par `requireProductionRole` au niveau du layout `/production`) :
rappels actifs, plans d'entretien, historique. Distincte de la fiche client
(`/espace-client/vehicules/[id]`, ownership stricte) pour ne jamais exposer
les données d'un véhicule à un client qui n'en est pas propriétaire.

## API

`GET /api/vehicles/[id]/history` (client, `?category=&offset=&limit=`),
`GET /api/vehicles/[id]/maintenance`, `GET /api/vehicles/[id]/reminders`,
`POST /api/vehicles/[id]/mileage` (client, jamais de régression forcée),
`POST /api/production/vehicles/[id]/mileage` et
`POST /api/technicien/vehicles/[id]/mileage` (avec `confirmed` possible),
`POST /api/maintenance-plans`, `PATCH /api/maintenance-plans/[id]`,
`POST /api/maintenance-reminders`, `POST /api/maintenance-reminders/[id]/cancel`,
`POST /api/maintenance-reminders/[id]/request-appointment`,
`GET /api/production/maintenance` (`?window=today|7d|30d|overdue`),
`POST /api/production/maintenance/check-reminders`.

## Migrations

1. `20260830000000_maintenance_type` — `MaintenanceReminderLevel`, colonnes
   ajoutées à `WorkOrderItem`/`MaintenancePlan`/`MaintenanceReminder`,
   index, puis renommage de `MaintenanceType` (16 valeurs).
2. `20260830000050_reminder_status` — renommage de `ReminderStatus` (5
   valeurs).
3. `20260830000100_maintenance_notifications` — 3 valeurs `NotificationEvent`.

Séparées en 3 migrations après une première tentative combinée en échec
(`ALTER COLUMN` référençant une colonne pas encore créée dans le même
fichier, plus deux blocs `AlterEnum` explicites `BEGIN/COMMIT` dans un même
fichier — la seconde tentative a révélé l'ordre incorrect généré par
`prisma migrate diff`, corrigé manuellement). `prisma migrate dev` refusant
l'environnement non interactif (déjà rencontré en Phase 3/6/7), toutes
écrites à la main puis appliquées via `prisma migrate deploy`.

## Tests

42 nouveaux tests unitaires (`maintenance/service.test.ts`,
`vehicles/history.test.ts`, `vehicles/mileage.test.ts`) — 209 au total.
Couvrent : niveaux d'alerte (date/km/date+km, le plus urgent gagne),
plans (création, intervalle obligatoire, désactivation), rappels (création
par date/km/les deux, annulation), notifications progressives (anti-spam,
progression de niveau), entretien terminé (clôture du rappel, calcul de la
prochaine échéance, aucun effet si aucune ligne rattachée), rappel →
ServiceRequest (pré-remplissage, ownership), historique (agrégation,
catégorisation, filtre, pagination, ownership, jamais d'événement pour un
brouillon/Work Order non terminé), kilométrage (relevé, historique,
anti-régression, confirmation).

Vérifié en conditions réelles (Neon) : relevé kilométrique + garde
anti-régression, création plan + rappel, clôture automatique via un Work
Order réel avec ligne rattachée (`OIL_CHANGE`), calcul de la prochaine
échéance (110 000 km attendu, confirmé). Vérifié en navigateur (client
`+22369999002`, admin `+22370000001`) : dashboard "Entretien & rappels",
fiche véhicule (prochain entretien + timeline), bouton "Prendre
rendez-vous" (création réelle de `CHC-SR-000008`, pré-remplie), Control
Center "Maintenance" (rappel actif + véhicules sans plan), fiche véhicule
production (rappels/plans/historique, historique mis à jour en temps réel
après la création de la demande). Données de test nettoyées après
vérification.

## Non couvert (volontairement, Phase 8)

- Automatisation réelle du déclenchement des rappels (cron/scheduler) —
  déclenchement manuel uniquement pour l'instant.
- Génération automatique d'un plan d'entretien depuis marque/modèle/année
  (aucune source constructeur vérifiée disponible).
- Système EV/Hybride spécialisé (diagnostic batterie haute tension, état de
  charge...) — préparé via `fuelType` mais pas construit.
- Diffusion de notification à un rôle (production) plutôt qu'à un
  utilisateur unique.
- Rapprochement du kilométrage constaté en diagnostic (`Diagnostic.mileageAtVisit`)
  avec `MileageReading` — restent deux sources parallèles non fusionnées
  automatiquement dans cette phase.
