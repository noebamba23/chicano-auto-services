// Seuils opérationnels par défaut du CRM (Phase 10) — pas des données
// métier vérifiées, de simples réglages applicatifs documentés (même
// discipline que UPCOMING_DAYS/DUE_DAYS de src/lib/maintenance/service.ts),
// voir docs/CRM.md. Ajustables ici sans toucher à la logique de calcul.

// Un client sans activité depuis ce nombre de jours est considéré DORMANT
// (exemple donné explicitement par la spécification Phase 10).
export const DORMANT_THRESHOLD_DAYS = 180;

// VIP : seuil de revenu cumulé encaissé (XOF) OU de nombre d'interventions
// terminées, le premier atteint suffit.
export const VIP_REVENUE_THRESHOLD_XOF = 1_000_000;
export const VIP_WORK_ORDER_THRESHOLD = 5;

// "Client récurrent" — même seuil que getBusinessDashboardKpis() (Phase 9,
// src/lib/billing/dashboard.ts) : ≥ 2 Work Orders terminés.
export const RECURRING_WORK_ORDER_THRESHOLD = 2;

// Devis refusé pris en compte comme signal AT_RISK seulement s'il est
// récent (au-delà, ne pèse plus sur la relance commerciale).
export const REFUSED_QUOTE_WINDOW_DAYS = 90;

// Un Work Order bloqué (ON_HOLD/WAITING_PARTS) depuis plus longtemps que ce
// seuil est considéré comme une "intervention interrompue".
export const INTERRUPTED_WORK_ORDER_DAYS = 14;

// "Longue inactivité" (signal AT_RISK) : fenêtre d'alerte précoce, avant le
// seuil DORMANT_THRESHOLD_DAYS — un client déjà servi qui n'a plus donné
// signe depuis 90 à 179 jours est encore récupérable (AT_RISK) ; au-delà de
// DORMANT_THRESHOLD_DAYS, il devient DORMANT (état confirmé, plus une
// alerte précoce). Les deux fenêtres ne se chevauchent jamais.
export const AT_RISK_INACTIVITY_DAYS = 90;
