# Demandes de service, urgence, géolocalisation, rendez-vous — Phase 3

## Modèle métier — trois concepts distincts

Règle d'architecture centrale de la Phase 3, à ne jamais confondre :

- **`ServiceRequest`** — « le client demande un service ». Créée par le client, revue
  par CHICANO.
- **`Appointment`** — « un créneau et un lieu sont planifiés ». N'existe qu'une fois
  la demande **acceptée** ; relation 1:1 avec `ServiceRequest` (`Appointment.serviceRequestId`
  unique).
- **Intervention** — « l'équipe CHICANO exécute effectivement le service ». Hors
  périmètre de la Phase 3 (diagnostic complet, rapport, devis, réparation,
  facturation, application technicien) — les modèles `Diagnostic`, `Quote`,
  `WorkOrder`, `Invoice` existent déjà dans le schéma (Phase 0) mais leur logique
  métier reste à construire dans une phase ultérieure.

```
CLIENT → VÉHICULE → DEMANDE (ServiceRequest) → QUALIFICATION CHICANO
       → RENDEZ-VOUS (Appointment) → [Intervention — phase suivante]
```

## CHC-SR-000001

Même mécanisme que `CHC-VH-000001` (Phase 2) : `ServiceRequest.sequenceNumber` est
une colonne `@default(autoincrement())` (compteur natif Postgres, atomique sous
concurrence), `referenceNumber` est dérivé de ce compteur via
`formatServiceRequestReference()` — jamais la clé primaire.

## Statuts et transitions

```
ServiceRequest : DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED → COMPLETED
                              ↘ REJECTED     ↘ CANCELLED    ↘ RESCHEDULE_REQUESTED
```

Contrôlées exclusivement côté serveur par une table de transitions autorisées
(`ALLOWED_TRANSITIONS` dans `src/lib/service-requests/service.ts`) — toute tentative
hors table lève `ServiceRequestConflictError` (409). Le frontend ne peut jamais fixer
un statut directement : chaque transition passe par une route dédiée
(`cancel`/`accept`/`reject`/`reschedule`), jamais par un `PATCH` générique.

`Appointment` réutilise l'énumération riche déjà posée en Phase 0
(`AppointmentStatus`, section 26 du cahier des charges d'origine — inclut les états
techniciens `ASSIGNED`/`TECHNICIAN_EN_ROUTE`/`ARRIVED`/`IN_PROGRESS` pour les phases
suivantes). Correspondance avec le vocabulaire de la Phase 3 :
`REQUESTED`→`PENDING`, `CONFIRMED`→`ACCEPTED` — pas de nouvel enum nécessaire, la
Phase 3 n'utilise qu'un sous-ensemble de valeurs déjà existantes.

## Pourquoi pas de `POST /api/appointments`

Un `Appointment` naît **toujours** comme effet de bord de
`POST /api/service-requests/[id]/accept` — la relation 1:1 avec `ServiceRequest`
rend une création indépendante dénuée de sens dans ce modèle (aucun rendez-vous
« orphelin »). Seules les routes de lecture (`GET /api/appointments`,
`GET /api/appointments/[id]`) sont exposées côté client.

## Urgence

`isUrgent` (booléen) + `urgencyDescription` (texte court, **obligatoire côté
application** si `isUrgent = true`, validé par `createServiceRequestSchema`) +
`urgencyReason` (enum optionnel hérité de la Phase 0, catégorisation fine non
utilisée par l'assistant de demande actuel mais disponible pour affinage futur).

**Une demande urgente n'est jamais acceptée automatiquement** : elle suit exactement
le même workflow `SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED` que toute autre
demande — seul le badge 🔴 et le tri (`isUrgent desc` dans
`listServiceRequestsForProduction`) la distinguent côté Control Center.

## Géolocalisation — contexte malien

`RequestLocation`/`AppointmentLocation` (posés en Phase 0) acceptent latitude/
longitude/precision **et** adresse libre/ville/commune/quartier/point de repère —
combinables (`hasUsableLocation()` dans `lib/validation/service-requests.ts` accepte
soit des coordonnées, soit au moins un champ de texte libre, jamais un format
d'adresse strict). Capture via l'API Geolocation du navigateur (`useMyPosition()`
dans le composant assistant) avec repli sur la saisie manuelle si refusée ou
indisponible — le système reste utilisable sans GPS.

La localisation n'est jamais publique : accessible uniquement au client
propriétaire (ownership stricte, même règle que les véhicules) et à l'équipe
production (RBAC).

## MapService

Abstraction posée (`src/lib/maps/provider.ts`), implémentation MVP
`OpenStreetMapProvider` — aperçu statique par iframe, **aucune dépendance JS ni clé
API**. Limite assumée pour cette phase : pas de marqueur déplaçable à la souris (un
vrai composant interactif type Leaflet/Mapbox nécessiterait une dépendance et une UX
plus lourdes, hors scope du « moteur » que la Phase 3 doit livrer) — la correction se
fait en pratique par bascule vers la saisie d'adresse libre, déjà combinable avec un
point GPS.

## Créneaux

Configurables dans `src/lib/service-requests/options.ts` (`SERVICE_SLOTS`) — changer
l'offre ne touche ni au schéma ni à l'API, seulement à cette liste. Stockés comme
simple libellé (`preferredSlot`/`scheduledSlot`), pas de colonnes heure début/fin
séparées — décision délibérée : les créneaux sont des plages fixes prédéfinies, pas
des horaires libres.

## Permissions

- **Client** : créer une demande *pour ses propres véhicules actifs uniquement*
  (vérifié via `getVehicleForCustomer` + statut `ACTIVE`), consulter/annuler ses
  propres demandes, consulter ses propres rendez-vous. Jamais l'inverse — un
  véhicule ou une demande d'un autre client se comporte comme inexistant (404),
  même règle qu'en Phase 2.
- **Production** (`PRODUCTION_STAFF`/`ADMIN`/`SUPER_ADMIN`) : lecture de toutes les
  demandes (pas de filtre ownership), actions accept/reject/reschedule. Gardé par
  `requireProductionRole()` (`src/lib/rbac.ts`) à la fois au niveau des routes API et
  de `src/proxy.ts` (redirection rapide d'un client qui tenterait `/production/**`).
- Un client ne peut **jamais** appeler accept/reject/reschedule, même sur sa propre
  demande — ces routes ne vérifient pas l'ownership, elles vérifient le rôle.

## Notifications

`NotificationService` (`src/lib/notifications/service.ts`) : résout le
`NotificationTemplate` de l'événement, interpole `{{variables}}`, envoie via le
`WhatsAppProvider` déjà en place (Phase 1 — mock en dev, jamais présenté comme Meta
actif tant que `WHATSAPP_PROVIDER_MODE≠"meta"`), journalise dans `Notification`. Un
échec d'envoi n'annule jamais l'opération métier qui l'a déclenché (best-effort,
erreur consignée en `FAILED`).

Événements Phase 3 : `REQUEST_RECEIVED` (déjà existant), `REQUEST_ACCEPTED`,
`REQUEST_REJECTED`, `RESCHEDULE_REQUESTED`, `APPOINTMENT_CONFIRMED` (réservé, non
déclenché par le code actuel — l'acceptation envoie `REQUEST_ACCEPTED`, qui couvre
déjà la confirmation du rendez-vous dans le flux simplifié de cette phase),
`APPOINTMENT_CANCELLED` (réservé, non déclenché — l'annulation envoie via le même
canal que la demande annulée ; pas de notification dédiée à ce stade).

## Règles métier serveur (jamais côté client)

- Création : utilisateur authentifié + `VERIFIED` + véhicule possédé et `ACTIVE`.
- `interventionType = MOBILE` → localisation obligatoire (GPS ou texte libre).
- `isUrgent = true` → `urgencyDescription` obligatoire.
- Annulation : `SUBMITTED`/`UNDER_REVIEW`/`RESCHEDULE_REQUESTED`/`ACCEPTED` →
  `CANCELLED` ; jamais depuis `COMPLETED`/`REJECTED`/`CANCELLED`. L'annulation
  cascade sur l'`Appointment` lié s'il existe.

## Historique

Pas de nouveau modèle : `AuditLog` (posé en Phase 0, déjà utilisé pour les véhicules
en Phase 2) est réutilisé tel quel — `SERVICE_REQUEST_CREATED`,
`SERVICE_REQUEST_ACCEPTED`, `SERVICE_REQUEST_REJECTED`,
`SERVICE_REQUEST_RESCHEDULE_REQUESTED`, `SERVICE_REQUEST_CANCELLED`.

## Ce qui n'est pas construit dans cette phase (volontairement)

- Diagnostic, rapport de diagnostic, devis, réparation, facturation.
- Application technicien complète (`Technician`/`TechnicianAssignment` existent,
  aucune UI dédiée — la production peut voir un rendez-vous accepté mais
  l'affectation d'un technicien viendra dans une phase ultérieure).
- Réponse du client à une contre-proposition de créneau (`RESCHEDULE_REQUESTED`) :
  le statut et le nouveau créneau proposé sont visibles côté client, mais aucune
  action dédiée d'acceptation n'est exposée — en pratique le suivi se fait par
  contact direct, cohérent avec une petite équipe de lancement.
- Marqueur de carte déplaçable (voir section MapService).
