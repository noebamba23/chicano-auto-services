# CRM, Customer 360 & croissance commerciale (Phase 10)

## Objectif métier

Donner à la production les moyens de mieux connaître, servir, fidéliser et
faire revenir un propriétaire de véhicule — pas construire un CRM générique.
Chaque fonctionnalité de cette phase répond directement à une question
opérationnelle CHICANO (qui est ce client ? faut-il le relancer ? a-t-il un
entretien en retard ? est-il éligible à CHICANO CARE ?), jamais à une
fonctionnalité "CRM classique" sans valeur directe pour l'atelier.

## Périmètre MVP

Construit : segmentation comportementale déterministe, Customer 360 (vue
agrégée), consentement (opérationnel vs marketing), interactions, relances
(follow-ups), campagnes minimales, CHICANO CARE (voir
[`CHICANO-CARE.md`](CHICANO-CARE.md)), parrainage (architecture
préparatoire uniquement), annuaire CRM production, dashboard CRM + KPI CEO.

Explicitement **non construit** dans cette phase : marketing automation
complexe, scoring par IA, paiement récurrent automatique, ERP, fleet
management complet, système d'affiliation complet, intégration WhatsApp
Business API réelle, moteur de recommandation. Voir chaque section
ci-dessous pour le détail de la limite correspondante.

## Architecture générale

Tout le code CRM vit sous `src/lib/crm/` (segmentation, consentement,
Customer 360, interactions, relances, campagnes, CHICANO CARE, parrainage,
annuaire, dashboard — un seul dossier cohérent plutôt que dispersé, chaque
fichier correspondant à un sous-domaine). Routes production sous
`src/app/api/production/crm/*` et `src/app/production/crm/*` (RBAC
`requireProductionRole()`/`requireAdminRole()`). Routes client sous
`src/app/api/consent` et `src/app/espace-client/care` +
`src/app/espace-client/parametres` (RBAC `requireVerifiedCustomer()`).

**Règle fondamentale, appliquée à chaque domaine de cette phase** : le CRM
orchestre et donne de la visibilité sur les domaines métier existants
(ServiceRequest, WorkOrder, Invoice, MaintenancePlan/Reminder...) — il ne
les duplique jamais et ne crée aucun second historique parallèle.

## Segmentation

Six segments, calculés **à la volée** depuis les données réelles
(`src/lib/crm/segmentation.ts`), jamais stockés en base — même discipline
que `MaintenanceReminderLevel` (Phase 8) : pas de champ à resynchroniser,
pas de risque de valeur périmée.

| Segment | Règle |
| --- | --- |
| `AT_RISK` | Au moins un signal parmi : devis refusé (< 90 j), entretien en retard (`MaintenanceReminderLevel = OVERDUE`, réutilise `computeReminderLevel()`), facture impayée en retard, intervention interrompue (`ON_HOLD`/`WAITING_PARTS` depuis ≥ 14 j), inactivité 90-179 j après un premier service. Priorité la plus haute. |
| `DORMANT` | Aucune activité depuis ≥ `DORMANT_THRESHOLD_DAYS` (180 j par défaut, centralisé dans `src/lib/crm/config.ts`), avec au moins une intervention terminée dans le passé. |
| `VIP` | Revenu cumulé encaissé ≥ 1 000 000 XOF **ou** ≥ 5 interventions terminées. |
| `RECURRING` | ≥ 2 interventions (`WorkOrder`) terminées — même seuil que "clients récurrents" du dashboard CEO (Phase 9), pour rester cohérent. |
| `ACTIVE` | ≥ 1 intervention terminée. |
| `NEW` | Aucune intervention terminée. |

**Aucun scoring IA, aucune boîte noire.** Chaque règle est un seuil
explicite et documenté ci-dessus, vérifiable en relisant
`computeSegment()`. Testé déterministe (`crm.test.ts` : deux appels
successifs sur les mêmes données renvoient toujours le même segment).

Un second calcul, distinct — le **parcours client** (`journeyStage`) —
répond à une question différente ("où en est la relation dans le temps ?")
plutôt qu'au ciblage marketing : `PROSPECT → NEW_CUSTOMER →
ACTIVE_CUSTOMER → RECURRING_CUSTOMER → CARE_CUSTOMER`, avec `DORMANT`/
`AT_RISK` en état de dérive. `CARE_CUSTOMER` prime sur tout le reste dès
qu'un abonnement CHICANO CARE est actif — c'est le palier relationnel le
plus engagé de la plateforme.

Les seuils ci-dessus sont des réglages applicatifs, pas des données
vérifiées auprès d'un tiers — ajustables dans `config.ts` sans toucher à
la logique de calcul.

## Customer 360

`getCustomer360(customerId)` (`src/lib/crm/customer360.ts`) agrège, en un
nombre **borné** de requêtes (~15, fixe, jamais une requête par ligne
d'historique), les domaines suivants — chacun via la fonction
"ForCustomer"/"ForProduction" **déjà existante** de son propre domaine,
jamais une requête réinventée ici :

- **Customer** : identité, coordonnées, `customerType`, consentement,
  informations CRM (segment, parcours).
- **Vehicles** (`listVehiclesForCustomer`, réutilisé).
- **ServiceRequests** (`listServiceRequestsForCustomer`).
- **Appointments** (`listAppointmentsForCustomer`).
- **Diagnostics / Reports** : rapports de diagnostic publiés
  (`listPublishedReportsForCustomer`) — pas de page détail production
  dédiée existante, affiché en résumé uniquement (voir "Liens" ci-dessous).
- **Quotes** (`listQuotesForCustomer`).
- **WorkOrders** (`listWorkOrdersForCustomer`).
- **Invoices**, **y compris DRAFT** : `listInvoicesForProduction({
  customerId })` — volontairement **différent** de
  `listInvoicesForCustomer()` (espace client), qui exclut les brouillons.
  Une vue production doit voir qu'un Work Order terminé a généré une
  facture encore en attente d'émission.
- **Payments** : jamais requêtés séparément — chaque facture porte déjà
  `invoice.payments` (voir `docs/BILLING.md`). Aucun second moteur
  financier.
- **Maintenance** : rappels actifs (`MaintenanceReminder`), réutilise
  `computeReminderLevel()` — le moteur de maintenance (Phase 8) n'est ni
  dupliqué ni modifié.
- **Interactions** (`listInteractionsForCustomer`, paginé).
- **FollowUps** (`listFollowUpsForCustomer`, paginé).
- **CHICANO CARE** (`listCareSubscriptionsForCustomer`).

Résumé chiffré (`summary`) calculé sur les factures **hors DRAFT**
uniquement (`totalBilled`, `unpaidInvoices`) — un brouillon n'engage rien.

**Customer 360 agrège les données existantes et ne crée aucun second
historique.** Aucune table de type "CustomerActivityLog" n'existe ni n'est
prévue : toute nouvelle vue doit continuer à lire les domaines existants,
jamais republier une copie.

### Liens

Chaque section de la fiche production (`/production/crm/clients/[id]`)
pointe vers la page détail existante quand elle existe :
`/production/demandes/[id]` (ServiceRequest), `/production/work-orders/[id]`
(WorkOrder), `/production/facturation/[id]` (Invoice, avec ses paiements).
Devis et rapports de diagnostic n'ont pas de page détail dédiée dans ce
projet (déjà affichés en ligne sur la fiche ServiceRequest) — affichés en
résumé seulement, sans lien, plutôt que de créer une architecture
supplémentaire pour un besoin déjà couvert ailleurs.

## Interactions

`CustomerInteraction` (`src/lib/crm/interactions.ts`) — historique léger
d'échanges, réservé à la production (jamais exposé côté client).

Types : `CALL`, `WHATSAPP`, `EMAIL`, `SMS`, `NOTE`, `APPOINTMENT`,
`FOLLOW_UP`. Champs : `customerId`, `type`, `subject`, `content`,
`actorId`, `createdAt`. Contenu potentiellement sensible — jamais retourné
par une route accessible au rôle `CLIENT`. Pagination systématique (20 par
page). Ownership vérifié : les interactions d'un client ne fuient jamais
vers un autre (testé unitairement et sur Neon réel).

## FollowUps (relances)

`FollowUp` (`src/lib/crm/follow-ups.ts`) — relance commerciale/
opérationnelle simple : motif (`reason`, texte libre saisi par la
production), échéance (`dueAt`), statut.

Statuts : `PENDING → DONE` / `PENDING → CANCELLED` (`ALLOWED_TRANSITIONS`,
même pattern que `ServiceRequestStatus`/`WorkOrderStatus`). `DONE` et
`CANCELLED` sont terminaux — une seconde clôture est refusée
(`FollowUpConflictError`), testé unitairement et sur Neon réel.

**Les relances restent manuelles.** Devis refusé, facture impayée, client
dormant, entretien en retard sont des **motifs/signaux** que la production
peut lire (dans le bandeau "Signaux à risque" de la fiche client) et
utiliser pour décider de créer une relance — ce ne sont **jamais** des
triggers automatiques créant une `FollowUp` sans action humaine. Pas de
workflow commercial complexe : une relance a un motif, une échéance, un
statut, rien de plus.

Déclenchement de notification (`FOLLOW_UP_DUE`) : manuel via
`checkAndNotifyDueFollowUps()` / route `POST
/api/production/crm/follow-ups/check-due` — aucun scheduler dans ce
projet, même limite documentée que `checkAndNotifyReminders()` (Phase 8)
et `markOverdueInvoices()` (Phase 9).

## Campaigns

`Campaign` (`src/lib/crm/campaigns.ts`) — **pas un moteur de marketing
automation**, un objet minimal : nom, objectif, segment cible, canal,
message, statut.

Statuts : `DRAFT → SCHEDULED/RUNNING → COMPLETED` ou `CANCELLED`
(`ALLOWED_TRANSITIONS`). Le ciblage (`segment`) est **recalculé au moment
de l'envoi**, jamais une liste de destinataires figée à la création — un
client qui change de segment ou de consentement entre la création et
l'envoi est reflété honnêtement.

**Mode PREVIEW obligatoire** (`previewCampaign()`) avant tout envoi réel :
retourne le nombre de clients du segment, le nombre réellement éligibles
(consentement + canal disponible), sans jamais envoyer. L'UI production
désactive physiquement le bouton "Envoyer" tant que `eligible === 0`.

**`marketingOptIn` est obligatoire pour l'éligibilité marketing** — voir
section Consentement. Revérifié à l'envoi (`sendCampaign()`), jamais
seulement à la création.

### Limites assumées (honnêtes, jamais masquées)

- **Aucun scheduler réel** : `scheduledAt` reste informatif, un envoi n'a
  lieu que via une action production explicite (`POST
  /api/production/crm/campaigns/[id]/send`).
- **Aucun provider EMAIL réel, aucun provider SMS réel.** Une campagne sur
  ces canaux ne simule jamais un succès : `sendCampaign()` marque tous les
  destinataires comme non joignables (`skippedChannelUnavailable`),
  `sentCount = 0`. Testé unitairement.
- **WhatsApp reste mock/stub** tant que `WHATSAPP_PROVIDER_MODE≠"meta"` —
  réutilise le `WhatsAppProvider` existant (Phase 1), jamais présenté à
  l'écran comme une intégration Meta active
  (`isMockWhatsAppActive()` affiché honnêtement dans l'UI Campagnes).

## Consentement

Quatre champs sur `Customer`, absents avant cette phase (confirmé par
audit) : `whatsappOptIn`, `emailOptIn`, `smsOptIn`, `marketingOptIn` +
`consentGivenAt`/`consentSource`/`consentRevokedAt`. Tous à `false` par
défaut — aucun consentement marketing n'est présumé pour un client déjà
existant.

**Séparation stricte, jamais confondue** :

- **Consentement opérationnel** (transactionnel) : les notifications déjà
  existantes (Phases 1-9 — confirmation de demande, devis disponible,
  facture, rappel de rendez-vous...) restent **entièrement indépendantes**
  de ce système, jamais gatées par `whatsappOptIn`/`marketingOptIn`. Un
  client reçoit toujours les communications liées à sa propre transaction.
- **Consentement marketing** : uniquement pour les `Campaign`.
  `assertMarketingConsent()` exige `marketingOptIn === true` **avant même**
  d'examiner le canal — `whatsappOptIn = true` seul ne suffit jamais à
  autoriser une campagne. Testé explicitement (unitaire + Neon réel).

### Accès et modification

- **Client** (`GET`/`PATCH /api/consent`, page `/espace-client/parametres`)
  : gère lui-même ses quatre préférences, `customerId` toujours résolu
  depuis la session serveur (`requireVerifiedCustomer()`), jamais un
  paramètre d'entrée. `consentSource = "CLIENT_PORTAL"`.
- **Production** (`PATCH
  /api/production/crm/customers/[id]/consent`) : consentement recueilli
  oralement/par écrit, `consentSource = "PRODUCTION_STAFF"` — jamais un
  texte libre arbitraire, fixé côté serveur par la route appelante.

Chaque modification journalisée dans `AuditLog` (`CONSENT_UPDATED`,
ancien/nouveau état).

## RBAC

Aucun nouveau système — réutilisation stricte de l'existant :

- `requireVerifiedCustomer()` (Phase 2) : routes client, résout
  `customerId` depuis la session, jamais depuis un paramètre.
- `requireProductionRole()` (Phase 3) : `PRODUCTION_STAFF`/`ADMIN`/
  `SUPER_ADMIN` — "CRM opérationnel" (lecture, Customer 360, interactions,
  relances, proposer/gérer un abonnement CHICANO CARE existant).
- `requireAdminRole()` (**nouveau, Phase 10**, mais même pattern exact que
  `requireProductionRole()`) : `ADMIN`/`SUPER_ADMIN` uniquement — "CRM
  complet" (créer/modifier le catalogue CarePlan, créer/prévisualiser/
  envoyer une campagne).

**Pourquoi aucun rôle Manager supplémentaire** : ce projet n'a jamais
distingué de rôle Manager (voir `docs/BILLING.md`, section "Non couvert" —
déjà noté en Phase 9). `ADMIN`/`SUPER_ADMIN` couvrent le "CRM complet"
demandé par le cahier des charges Phase 10, `PRODUCTION_STAFF` le "CRM
opérationnel" — inventer un rôle Manager aurait dupliqué une distinction
qui n'existe nulle part ailleurs dans le RBAC du projet.

`TECHNICIAN` : aucune route CRM n'existe sous `/api/technicien/...` —
même discipline que la facturation (Phase 9), un technicien n'a pas accès
au CRM/marketing, uniquement à ses interventions.

## Ownership

**Un client ne peut accéder qu'à ses propres données** — appliqué
structurellement, pas seulement testé :

- Toute route client résout `customerId` depuis la session serveur
  (`requireVerifiedCustomer()`), jamais depuis un paramètre d'URL ou de
  corps de requête — un client ne peut pas fournir arbitrairement l'ID
  d'un autre pour accéder à ses données.
- Les fonctions "ForCustomer" (interactions, relances, Care, historique)
  filtrent systématiquement par `customerId`.
- Vérifié réellement sur Neon (deux comptes démo distincts) : aucune fuite
  d'interaction, de relance, d'abonnement Care, de facture, de devis, de
  rendez-vous ou d'ordre de réparation d'un client vers un autre — sur
  chacun des domaines agrégés par Customer 360.
- Côté production, l'accès à un client donné n'est pas une question
  d'"ownership" mais de RBAC (`requireProductionRole()`) : c'est le
  fonctionnement attendu d'un CRM, la production doit pouvoir consulter
  n'importe quel client.

## Limite connue (MVP)

Le **"taux rappel → rendez-vous"** affiché au dashboard CEO est une
**approximation**, pas un funnel exact : aucune relation directe n'est
persistée entre un `MaintenanceReminder` et le `ServiceRequest` qu'il a pu
générer (le schéma ne porte pas ce lien). La métrique compare le nombre de
rappels effectivement complétés dans le mois au nombre de rappels "arrivés
à échéance" (`DUE`/`OVERDUE`) — une mesure honnête mais indirecte.
Documentée ici comme limite assumée du MVP, pas corrigée par du code dans
cette phase.

## Non couvert (volontairement, Phase 10)

Marketing automation complexe, scoring par IA, paiement récurrent
automatique, ERP, fleet management complet, système d'affiliation complet
(le parrainage reste une architecture préparatoire, voir
[`CHICANO-CARE.md`](CHICANO-CARE.md)), API WhatsApp Business réelle sans
credentials configurés, moteur de recommandation IA, lien stocké
`MaintenanceReminder` → `ServiceRequest` (voir limite ci-dessus), CHICANO
POINTS / fidélité par points (aucune règle d'accrual fournie — inventer un
barème aurait violé la discipline "ne jamais inventer une règle métier"
appliquée depuis la Phase 0 ; le point d'ancrage `CareSubscription`/
`Payment` reste disponible pour une phase future si un barème réel est
fourni).
