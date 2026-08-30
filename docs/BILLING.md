# Facturation, paiements & rentabilité (Phase 9)

## Vision

```
DIAGNOSTIC → RAPPORT → DEVIS → ACCEPTATION → WORK ORDER → TRAVAUX →
CONTRÔLE QUALITÉ → FACTURE → PAIEMENT → REÇU → SOLDE
```

Le devis accepté reste la référence commerciale. Le Work Order reste la
référence opérationnelle. La facture devient la référence financière. Le
paiement devient la preuve d'encaissement. **Aucune nouvelle logique
parallèle de prix** : la facture est un snapshot des lignes du Work Order
(déjà lui-même un snapshot du devis accepté depuis la Phase 7).

## Placeholder existant

`Invoice`/`Payment` étaient posés en Phase 0 (structure minimale : montant
unique, pas de lignes, pas de reçu) — confirmés vides sur Neon avant
modification, étendus plutôt que remplacés.

## Invoice

Créée **uniquement** par `createInvoiceFromWorkOrder()`, appelée depuis
[`work-orders/service.ts::passQualityCheck()`](../src/lib/work-orders/service.ts)
au moment exact où le Work Order passe à `COMPLETED` — jamais avant, jamais
manuellement. Idempotente (`workOrderId` unique sur `Invoice`) : un second
appel retourne la facture déjà créée.

Champs : `sequenceNumber`/`invoiceNumber` (`CHC-FAC-000001`), `customerId`,
`vehicleId`, `workOrderId`, `quoteId`, `quoteVersionNumber` (snapshot),
`subtotal`/`discount`/`travelFee`/`tax`/`total` (aucun régime fiscal
inventé — montants libres, configurables), `amountPaid`/`balanceDue`,
`issuedAt`/`dueAt`/`paidAt`.

Statuts : `DRAFT → ISSUED → (PARTIALLY_PAID | PAID | OVERDUE) → ... →
(PAID | CANCELLED)`, transitions validées côté serveur
(`ALLOWED_TRANSITIONS`, même pattern que `ServiceRequestStatus`/
`WorkOrderStatus`). Une facture `ISSUED` n'est plus modifiable en place
(`assertEditable` réservé à `DRAFT`).

## InvoiceItem — snapshot

Reprend `WorkOrderItem` 1:1 (`sourceWorkOrderItemId` conservé) — jamais
recalculé depuis une valeur mutable du devis. `WorkOrderItem` étant déjà
lui-même un snapshot figé (Phase 7), la facture hérite de cette garantie
sans logique supplémentaire.

## Payment

`paymentNumber` (`CHC-PAY-000001`), lié à `invoiceId`/`customerId`,
`method` (CASH/ORANGE_MONEY/MOOV_MONEY/WAVE/BANK_TRANSFER/OTHER),
`status` (PENDING/CONFIRMED/FAILED/REFUNDED), `externalReference`/
`transactionReference`/`proofUrl`/`notes`, `receiptNumber` (posé
uniquement une fois `CONFIRMED`).

Point d'entrée unique : `recordPayment(invoiceId, input)`, utilisé aussi
bien par la production (n'importe quelle méthode) que par le client
(`initiateClientPayment`, Mobile Money uniquement). Le provider détermine
l'issue réelle :

- `CASH`/`BANK_TRANSFER`/`OTHER` → `ManualPaymentProvider`, confirme
  immédiatement (attestation directe de la production — la transaction a
  déjà eu lieu au moment de la saisie).
- `ORANGE_MONEY`/`MOOV_MONEY`/`WAVE` → `MobileMoneyStubProvider`, retourne
  toujours `NOT_CONFIGURED` (aucune intégration API réelle dans cette
  phase, aucun credentials). Le paiement est enregistré `FAILED`, **jamais
  `CONFIRMED`** — pas de faux paiement.

## Reçu — pas une table séparée

Le reçu (`CHC-RC-000001`) est une référence posée sur `Payment.receiptNumber`
une fois `CONFIRMED`, pas un modèle `Receipt` dédié — cohérent
architecturalement (le prompt laissait ce choix explicitement) et évite un
"deuxième historique parallèle" pour une information qui n'existe que
relativement à un paiement réel.

## Acompte / solde

`amountPaid`/`balanceDue` recalculés à chaque paiement `CONFIRMED`.
Invariants appliqués côté service (jamais côté DB, même discipline que
`ReminderStatus` en Phase 8) :

- Montant de paiement toujours `> 0`.
- `amount ≤ balanceDue` — un paiement ne peut jamais dépasser le solde
  restant.
- `PAID ⇔ amountPaid = total, balanceDue = 0`.
- `PARTIALLY_PAID ⇔ 0 < amountPaid < total`.

Exemple vérifié (voir "Neon" ci-dessous) : facture 450 000, acompte
150 000 → `PARTIALLY_PAID`, solde 300 000 ; solde réglé 300 000 →
`PAID`, solde 0.

## WorkOrder → Invoice

```
WorkOrder.status → COMPLETED (passQualityCheck)
      ↓
createInvoiceFromWorkOrder() — idempotente
      ↓
Invoice DRAFT (snapshot des lignes)
      ↓ (action production)
Invoice ISSUED
```

## Marge (jamais exposée au client ni au technicien)

`WorkOrderItem.costPrice` (coût CHICANO) reste distinct du prix client
déjà existant (`unitPrice`/`totalPrice`). `computeWorkOrderMargin()` :

```
REVENUE (subtotal + travelFee - discount de la facture)
- PARTS COST (Σ costPrice, items PART/SERVICE)
- LABOR COST (Σ costPrice, items LABOR)
- TRAVEL COST (0 — non distinctement suivi dans cette phase, voir Limites)
- OTHER COST (Σ costPrice, items OTHER)
= GROSS MARGIN
```

`costPrice` n'est modifiable que via `PATCH /api/production/work-orders/[id]/items/[itemId]`
(jamais depuis `/api/technicien/...`) — la fiche Work Order production
expose un sélecteur dédié, la marge n'apparaît que sur la fiche facture
production (encadré visuellement séparé du reste, jamais sur une page
`/espace-client/...`).

## Dashboard production (`/production/facturation`)

Liste des factures, filtres (Tout/Brouillons/Émises/Partiellement payées/En
retard/Payées), total encaissé/restant dû. Fiche facture : lignes, détail
paiements, marge (production/admin — aucune distinction Manager/Admin
n'existe dans le RBAC actuel de ce projet, `requireProductionRole()` couvre
uniformément PRODUCTION_STAFF/ADMIN/SUPER_ADMIN).

## Dashboard CEO (`/production/dashboard`)

KPI calculés depuis les données réelles (`getBusinessDashboardKpis()`) :
CA du jour/du mois, encaissements, factures émises/impayées, interventions
du mois, panier moyen, taux d'acceptation des devis, marge brute du mois,
clients/véhicules actifs (mois), clients récurrents (≥2 Work Orders).

## Espace client (`/espace-client/factures`)

Liste (statut ≠ DRAFT uniquement — une facture non émise reste invisible
côté client, même discipline que les devis DRAFT), détail (lignes, solde,
paiements/reçus confirmés), bouton **Payer** (Mobile Money uniquement,
n'apparaît que si la facture est payable). Le bouton ne lance jamais une
transaction externe réelle ; en l'absence de provider configuré, un message
honnête est affiché ("pas encore disponible en ligne"), aucun paiement
`CONFIRMED` n'est créé.

## RBAC

- **Client** : voit ses factures/paiements/reçus (ownership 404), peut
  initier un paiement Mobile Money (jamais CASH/virement — réservé à la
  production).
- **Technicien** : aucune route de facturation n'existe sous
  `/api/technicien/...` — aucun accès aux factures, paiements ou marges.
- **Production** : gère factures (émettre/annuler/ajuster tant que DRAFT),
  enregistre des paiements (toute méthode), consulte soldes et marge.
- **Admin** : accès complet (même garde `requireProductionRole` que
  production — pas de rôle Manager distinct dans ce projet).

## Ownership

`getInvoiceForCustomer(customerId, invoiceId)` — 404 si la facture
n'appartient pas au client appelant, même discipline que partout ailleurs
dans la plateforme.

## AuditLog

Réutilisé (pas de nouvelle table) : `INVOICE_CREATED`, `INVOICE_ISSUED`,
`INVOICE_CANCELLED`, `INVOICE_OVERDUE`, `PAYMENT_CREATED`,
`PAYMENT_CONFIRMED`, `INVOICE_PAID`.

## Notifications

5 événements ajoutés (`INVOICE_ISSUED`, `PAYMENT_RECEIVED`,
`PAYMENT_PARTIAL`, `INVOICE_PAID`, `PAYMENT_FAILED`), 35 templates au
total sur Neon.

## Travaux supplémentaires

Aucun changement par rapport à la Phase 7 : `requestAdditionalWork()` pose
uniquement un flag léger sur le Work Order — vérifié que cela ne modifie ni
le devis accepté ni une facture déjà créée (voir tests). Un coût
supplémentaire réel nécessite un nouveau devis/version, une acceptation
client, puis une mise à jour commerciale explicite — jamais automatique.

## CHICANO CARE / B2B

Aucune construction dans cette phase — `MaintenancePlan`/
`MaintenanceReminder` (Phase 8) restent la base sur laquelle une offre
commerciale pourrait être construite plus tard. `Company`/`Fleet`
(Phase 0, toujours inexploités) ne sont ni modifiés ni bloqués.

## Migrations

3 migrations isolées (leçon retenue de la Phase 8 — ne jamais mélanger
plusieurs blocs `AlterEnum` transactionnels dans un même fichier) :

1. `20260901000000_billing` — `InvoiceItemType`, extension `Invoice`/
   `Payment`/`WorkOrderItem`, table `InvoiceItem`, `InvoiceStatus.OVERDUE`.
2. `20260901000100_billing_notifications` — 5 valeurs `NotificationEvent`.
3. `20260901000200_payment_method` — renommage `PaymentMethod` (séparation
   Orange/Moov/Wave).

Toutes appliquées avec succès au premier essai (contrairement à la Phase 8
où une tentative combinée avait échoué) — voir section "Bugs" du rapport
Phase 9 pour le détail de la leçon appliquée en amont cette fois.

## Tests

19 nouveaux tests unitaires (`billing/service.test.ts`) — 228 au total.
Couvrent : création automatique + snapshot + idempotence + refus avant
COMPLETED, cycle de statut, paiement unique/partiel/acompte-puis-solde
(exemple exact du prompt : 150 000 + 300 000 sur 450 000), refus paiement
> solde et ≤ 0, reçu uniquement si confirmé, Mobile Money non configuré
(jamais PAID), notifications progressives, ownership, marge (calcul exact),
travaux supplémentaires sans impact sur la facture.

## Neon

Scénario E2E réel exécuté intégralement (voir rapport) : Quote ACCEPTED →
WorkOrder COMPLETED → Invoice DRAFT (`CHC-FAC-000001`) → ISSUED → Paiement
150 000 → `PARTIALLY_PAID` solde 300 000 → Paiement 300 000 → `PAID` solde
0, 2 reçus générés, relu par une requête indépendante pour confirmer la
persistance réelle, données nettoyées.

## Non couvert (volontairement, Phase 9)

- Aucune intégration API réelle Mobile Money (Orange/Moov/Wave) — stubs
  honnêtes uniquement.
- Aucun régime fiscal calculé automatiquement (`tax` reste un montant
  libre saisi par la production).
- Coût de déplacement (`TRAVEL COST`) non distinctement suivi — reste à 0
  dans le calcul de marge (aucune ligne `WorkOrderItem` ne représente
  actuellement un déplacement facturable séparément).
- Distinction de rôle Manager vs Admin (le prompt en fait mention, ce
  projet n'a que PRODUCTION_STAFF/ADMIN/SUPER_ADMIN).
- Système d'abonnement CHICANO CARE, flotte B2B complète — non construits,
  non bloqués.
- Automatisation réelle du passage `OVERDUE` (déclenchement manuel
  uniquement, aucun scheduler dans ce projet — même limite que
  `docs/MAINTENANCE.md`).
- Document facture imprimable au format PDF — la fiche facture (production
  et client) est lisible/professionnelle à l'écran, aucune génération PDF
  dédiée dans cette phase.
