# Work Order (Phase 7) — validation, réparation, clôture

## Périmètre

```
DEVIS ACCEPTÉ → WORK ORDER → PLANIFICATION → AFFECTATION → EXÉCUTION →
PIÈCES → MAIN-D'ŒUVRE → CONTRÔLE QUALITÉ → TERMINÉ
```

Hors périmètre (volontairement) : facturation, paiement, comptabilité,
stock avancé (rapprochement `Inventory`), gestion fournisseurs, marketplace
pièces, système de remorquage complet, CRM avancé.

## Placeholder existant

Un modèle `WorkOrder`/`WorkOrderTask`/`WorkshopTransfer` avait été posé dès
la toute première migration (Phase 0), jamais exploité par l'application.
Vérifié vide sur Neon avant toute modification (`workOrders: 0,
workOrderTasks: 0, workshopTransfers: 0, invoices: 0`) — sa refonte n'a donc
entraîné aucune perte de donnée. `WorkOrderTask` a été remplacé par
`WorkOrderItem` ; `WorkshopTransfer` a été conservé quasi tel quel
(correspondait déjà au besoin d'embarquement garage).

## Modèle de données

- `WorkOrder` — `workOrderNumber` (`CHC-WO-000001`, même mécanisme que les
  autres références métier), `customerId`, `vehicleId`, `serviceRequestId`,
  `appointmentId?`, `quoteId` (`@unique` — un seul Work Order par devis
  accepté), `acceptedQuoteVersionNumber` (figé à la création),
  `diagnosticReportId?`, `technicianId?`, `status`, `priority`,
  `scheduledDate?`, champs contrôle qualité (`qualityCheckPassed/Notes/
  CheckedById/CheckedAt`), `testDrivePerformed/Notes`,
  `additionalWorkRequested/Notes`, `requiresTowing`.
- `WorkOrderItem` — travaux (LABOR/PART/SERVICE/OTHER), `sourceQuoteItemId`
  (traçabilité vers le devis accepté), `status`, `estimatedMinutes/
  actualMinutes/technicianId` (suivi main-d'œuvre).
- `WorkOrderPart` — pièces nécessaires (statuts REQUESTED → AVAILABLE/
  ORDERED → RECEIVED → INSTALLED, ou NOT_REQUIRED). Volontairement pas un
  ERP de stock : aucun rapprochement avec `Inventory.quantity`.
- `WorkOrderPhoto` — modèle relationnel dédié (avant/après), cohérent avec
  `VehiclePhoto`/`ReportPhoto` — pas de `photoUrls String[]` brut.
- `WorkshopTransfer` — embarquement garage (intervention mobile où la
  réparation s'avère impossible sur place), conservé minimal.

Historique : `AuditLog` existant réutilisé pour toutes les actions
importantes (`WORK_ORDER_CREATED`, `TECHNICIAN_ASSIGNED`, `WORK_STARTED`,
`QUALITY_CHECK_PASSED`, etc.) — pas de nouvelle table dédiée.

## Création — automatique, jamais manuelle

```
Quote.status → ACCEPTED
      ↓
createWorkOrderFromQuote() (appelé depuis acceptQuote())
      ↓
WorkOrder créé (récupère automatiquement client/véhicule/ServiceRequest/
appointment/technicien déjà affecté/rapport de diagnostic/lignes du devis
accepté — aucune ressaisie)
      ↓
READY (pas de date planifiée) ou SCHEDULED (rendez-vous déjà daté)
```

Aucune route `POST /api/work-orders` n'existe : la création est un effet de
bord serveur de `acceptQuote()`, jamais déclenchable par le client ou la
production. Idempotent sur `quoteId` (contrainte unique) — un second appel
retourne le Work Order déjà créé.

**Version du devis** : `acceptedQuoteVersionNumber` est figé à la création
et ne change jamais, même si le cycle de vie du devis évoluait après
`ACCEPTED` (aujourd'hui un devis `ACCEPTED` est terminal — aucun code ne
permet d'en sortir — mais ce champ ne dépend pas de cet invariant implicite).

**Travaux** : les lignes du devis accepté (`QuoteItem`) sont recopiées en
`WorkOrderItem` (`sourceQuoteItemId` conservé) ; le montant `laborAmount`
de la version devient une ligne `LABOR` séparée. `travelAmount`/
`discountAmount` ne génèrent pas de ligne (ajustements financiers, pas des
travaux à exécuter) — restent visibles via `workOrder.quote`.

## Statuts et transitions

```
DRAFT → READY → SCHEDULED → IN_PROGRESS → QUALITY_CHECK → COMPLETED
IN_PROGRESS ⇄ WAITING_PARTS
IN_PROGRESS ⇄ ON_HOLD
QUALITY_CHECK → IN_PROGRESS (contrôle qualité échoué, renvoyé en travaux)
* → CANCELLED (sauf COMPLETED/CANCELLED, statuts terminaux)
```

Contrôlé uniquement côté serveur (`ALLOWED_TRANSITIONS` +
`assertTransition()`, même pattern que `ServiceRequestStatus`). Un Work
Order ne peut jamais passer à `COMPLETED` sans passer par
`passQualityCheck()` (contrôle qualité obligatoire).

## Travaux supplémentaires

Signal léger uniquement (`additionalWorkRequested`/`additionalWorkNotes`) —
ne modifie jamais le devis accepté ni le total financier. Un nouveau
devis/version reste une action distincte, non déclenchée automatiquement.

## Mobile / embarquement garage

`WorkOrder.requiresTowing` signale qu'une réparation mobile s'est avérée
impossible sur place ; `WorkshopTransfer` trace l'embarquement effectif
(raison, état du véhicule, destination). L'`Appointment` initial n'est
jamais supprimé.

## Permissions

- **Client** : lecture seule (`getWorkOrderForCustomer`/
  `listWorkOrdersForCustomer`, ownership 404).
- **Technicien** : lecture + actions sur SES ordres affectés uniquement
  (`getWorkOrderForTechnician`, 404 si non affecté — même discipline que
  `technicians/service.ts`) : démarrer, pause, signaler pièce manquante,
  renseigner le travail effectué, envoyer au contrôle, signaler des travaux
  supplémentaires. Jamais : prix, statut de production, affectation.
- **Production** : contrôle complet du workflow (planifier, affecter,
  toutes les transitions, contrôle qualité, pièces, photos, embarquement).

## Notifications

7 événements ajoutés à `NotificationEvent` : `WORK_ORDER_CREATED`,
`WORK_SCHEDULED`, `WORK_STARTED`, `WORK_WAITING_PARTS`, `WORK_COMPLETED`
sont envoyés au client via `sendNotification()`. `QUALITY_CHECK_REQUIRED`
et `ADDITIONAL_WORK_REQUIRED` sont posés dans l'enum et le seed pour
complétude mais **jamais envoyés** : ce sont des signaux internes
production, et ce projet n'a aucun mécanisme de diffusion à l'équipe
(`NotificationService` cible un `userId` unique, pas un rôle).

## API

Aucune route `POST /api/work-orders` (voir "Création" ci-dessus).

Production (`requireProductionRole`) : `GET /api/production/work-orders`,
`GET .../[id]`, `POST .../schedule`, `.../assign-technician`, `.../start`,
`.../pause`, `.../resume`, `.../waiting-parts`, `.../quality-check`,
`.../quality-check/pass`, `.../quality-check/fail`, `.../cancel`,
`.../additional-work`, `.../parts` (POST), `.../parts/[partId]` (PATCH),
`.../items/[itemId]` (PATCH), `.../photos` (POST multipart),
`.../workshop-transfer` (POST), `.../workshop-transfer/receive` (POST).

Technicien (`requireTechnician`) : `GET /api/technicien/work-orders`,
`GET .../[id]`, `POST .../start`, `.../pause`, `.../missing-part`,
`.../quality-check`, `.../additional-work`, `.../photos` (POST multipart),
`PATCH .../items/[itemId]`.

Client : aucune route API — lectures directes côté serveur
(`/espace-client/reparations`).

## Migrations

1. `20260827100000_work_orders_phase7` — refonte complète du placeholder
   (WorkOrder/WorkOrderItem/WorkOrderPart/WorkOrderPhoto, `WorkOrderTask`
   supprimé). Tables confirmées vides avant modification, aucune perte de
   donnée réelle.
2. `20260827100100_work_order_notifications` — ajout des 7 valeurs
   `NotificationEvent` (`ALTER TYPE ... ADD VALUE`, migration séparée
   requise puisque la première migration était déjà appliquée à Neon).

`prisma migrate dev` refusant l'environnement non interactif (déjà
rencontré en Phase 3/6), les deux migrations ont été écrites à la main puis
appliquées via `prisma migrate deploy`.

## UI

- **Production** : `/production/work-orders` (Control Center, colonnes par
  statut) + `/production/work-orders/[id]` (fiche complète + actions selon
  statut).
- **Client** : `/espace-client/reparations` (liste) + `[id]` (détail en
  lecture seule, immatriculation jamais ressaisie).
- **Technicien** : `/technicien/reparations` (liste de ses ordres affectés)
  + `[id]` (détail + actions technicien).

## Tests

22 nouveaux tests unitaires (`src/lib/work-orders/service.test.ts`) — 167
au total. Couvrent : création automatique + référence + héritage des
données + travaux repris du devis, idempotence, ownership (client/
technicien, 404 jamais 403), toutes les transitions de statut (parcours
nominal, branches pièces/pause, contrôle qualité échoué, statuts
terminaux), planification, affectation, pièces, travaux supplémentaires
(sans impact sur le devis).

Vérifié en conditions réelles (Neon) : création automatique complète
(référence, auto-planification, héritage technicien, synchronisation des
lignes de travaux) via un scénario direct sur `createWorkOrderFromQuote()`,
relu par une requête indépendante pour confirmer la persistance réelle, puis
nettoyé. Vérifié en navigateur (client `+22369999001`, admin
`+22370000001`, technicien démo `+22370000030`) : liste et fiche
production, liste et fiche client, liste et fiche technicien, une
transition de statut réelle (SCHEDULED → IN_PROGRESS) déclenchée depuis
l'interface production et confirmée après rechargement. Données de test
nettoyées après vérification (véhicule, devis, diagnostic, rapport, Work
Order, logs d'audit orphelins).

## Non couvert (volontairement, Phase 7)

- Facturation, paiement, comptabilité (`Invoice`/`Payment` restent
  posés mais non câblés — prochaine phase).
- Rapprochement stock réel (`Inventory.quantity` non décrémenté par
  `WorkOrderPart`).
- Système de remorquage complet (`WorkshopTransfer` reste minimal).
- Diffusion de notification à un rôle (production) plutôt qu'à un
  utilisateur unique — `QUALITY_CHECK_REQUIRED`/`ADDITIONAL_WORK_REQUIRED`
  restent visibles uniquement via la fiche production, pas poussées.
