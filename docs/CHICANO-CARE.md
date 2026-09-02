# CHICANO CARE (Phase 10)

## Concept

Programme d'abonnement à l'entretien préventif : un client paie un plan
CHICANO CARE (prix/durée/fréquence libres, définis par la production, pas
imposés en dur) et bénéficie d'un suivi régulier de son véhicule. La
proposition de valeur MVP est volontairement simple — un plan, un
abonnement, un statut — pas une offre segmentée en options complexes.

## CarePlan

Catalogue géré en production (`/production/crm/care-plans`, réservé
`ADMIN`/`SUPER_ADMIN` en écriture — voir `docs/CRM.md`, section RBAC).
Champs : `name`, `description`, `price` (XOF), `durationMonths`,
`frequencyMonths`, `includedServices` (liste libre), `active`.

**Aucun prix fixe imposé par le code** — chaque plan est créé/modifié
librement par la production. Un plan désactivé (`active = false`) reste
consultable pour les abonnements déjà en cours mais ne peut plus être
proposé à un nouveau client (`createCareSubscription()` refuse avec
`CareConflictError`).

## CareSubscription

Lie un client (et optionnellement un véhicule précis — `vehicleId`
nullable : un abonnement peut couvrir un véhicule ou le compte client dans
son ensemble) à un `CarePlan`.

### États

`ACTIVE`, `PAUSED`, `CANCELLED`, `EXPIRED`.

### Transitions autorisées

```
ACTIVE  → PAUSED | CANCELLED | EXPIRED
PAUSED  → ACTIVE | CANCELLED | EXPIRED
CANCELLED → (terminal)
EXPIRED   → (terminal)
```

`CANCELLED` et `EXPIRED` sont des états terminaux — toute tentative de
transition depuis l'un de ces deux états est refusée
(`CareConflictError`), même pattern que `FollowUpStatus`/
`WorkOrderStatus`. Testé unitairement et vérifié sur Neon réel
(transition post-`CANCELLED` refusée).

### Idempotence

Chaque transition passe par `assertTransition()` avant d'écrire en base —
un appel sur un état incompatible échoue **avant** toute modification,
jamais un état partiellement mis à jour. `createCareSubscription()` vérifie
l'existence et l'activité du `CarePlan` avant de créer l'abonnement. Une
transition déjà appliquée ne peut jamais être répétée silencieusement :
appeler `cancelCareSubscription()` deux fois échoue explicitement la
seconde fois plutôt que de ne rien faire silencieusement.

## Client

Parcours en lecture seule (`/espace-client/care`) : liste des abonnements
(nom du plan, description, services inclus, prix, dates de début/fin,
statut), et les prochains entretiens (rappels actifs issus du moteur de
maintenance existant, voir ci-dessous). Un client sans abonnement voit un
état vide honnête ("Vous n'avez pas encore d'abonnement CHICANO CARE...").

La création d'un abonnement reste une action **production** (le CRM
"propose" un plan à un client, cohérent avec l'absence de paiement
récurrent automatique — voir plus bas) : pas d'auto-souscription client
dans cette phase.

## Rendez-vous

**Réutilise exactement** le mécanisme déjà construit en Phase 8, jamais
dupliqué :

```
CHICANO CARE (page client)
        ↓ bouton "Prendre rendez-vous" sur un rappel
ReminderAppointmentButton (composant réutilisé tel quel, Phase 8)
        ↓ POST /api/maintenance-reminders/[id]/request-appointment
createServiceRequestFromReminder()
        ↓
ServiceRequest (status SUBMITTED)
```

**Jamais** :

```
CHICANO CARE → Appointment direct
```

Un `Appointment` ne naît que comme effet de bord de l'acceptation d'une
`ServiceRequest` par la production (`acceptServiceRequest()`, Phase 3) —
aucune exception pour CHICANO CARE. Vérifié réellement (clic réel en
navigateur → `ServiceRequest CHC-SR-000015` créée, `status = SUBMITTED`).

## Maintenance

**Aucun deuxième moteur de maintenance.** CHICANO CARE réutilise tel quel
`MaintenancePlan`/`MaintenanceReminder`/`computeReminderLevel()` (Phase 8)
— un membre CHICANO CARE voit exactement le même historique, les mêmes
rappels, la même timeline que n'importe quel client, simplement présentés
dans le contexte de son abonnement. Le moteur de maintenance existant
n'est ni modifié ni contourné par cette phase.

## Paiement

**Aucun paiement récurrent automatique dans cette phase.** `CareSubscription`
ne fait que suivre la relation (statut, dates) — elle ne déclenche, ne
planifie et ne prélève jamais de paiement. Tout encaissement lié à un plan
CHICANO CARE passe par le flux manuel existant de la Phase 9
(`recordPayment()`, méthode au choix de la production) — voir
`docs/BILLING.md`. C'est une contrainte explicite du cahier des charges
Phase 10, pas un oubli : "la Phase 10 prépare seulement l'abonnement, les
paiements restent ceux de la Phase 9".

## Notifications

Quatre événements ajoutés à `NotificationEvent` (migration isolée
`20260902000100_crm_notifications`, une seule par leçon retenue Phase 8 —
jamais mélanger un bloc `AlterEnum` transactionnel avec des `ADD VALUE`
bruts dans le même fichier) :

| Événement | Déclenché par | Destinataire |
| --- | --- | --- |
| `CARE_STARTED` | `createCareSubscription()` | Client |
| `CARE_EXPIRING` | `checkExpiringCareSubscriptions()` (manuel) | Client |
| `CARE_EXPIRED` | idem, ou transition explicite vers `EXPIRED` | Client |
| `FOLLOW_UP_DUE` | `checkAndNotifyDueFollowUps()` (manuel) | Membre du personnel assigné (jamais le client — c'est une relance interne) |

Templates seedés dans `prisma/seed.ts` (39 templates au total sur Neon,
upsert idempotent — les comptes existants ne sont jamais recréés ni
supprimés par un nouveau `db:seed`).

**Le fournisseur WhatsApp mock ne doit jamais être présenté comme une
intégration Meta réelle** — ces quatre notifications passent par
`sendNotification()` (Phase 1), donc par le même `WhatsAppProvider` déjà
en place : tant que `WHATSAPP_PROVIDER_MODE≠"meta"`, l'envoi reste un log
serveur de développement, jamais un message réellement livré.

## Déclenchement manuel

Aucun scheduler/cron dans ce projet — `checkExpiringCareSubscriptions()`
(route `POST /api/production/crm/care/check-expiring`) doit être appelée
manuellement par la production, même limite documentée que
`checkAndNotifyReminders()` (Phase 8) et `markOverdueInvoices()`
(Phase 9).

## Non couvert (volontairement, Phase 10)

Paiement récurrent automatique, facturation périodique automatique d'un
abonnement, calcul de proratisation à la résiliation, renouvellement
automatique à expiration (`checkExpiringCareSubscriptions()` fait passer
un abonnement expiré à `EXPIRED`, mais n'en recrée jamais un nouveau),
auto-souscription client sans passage par la production.
