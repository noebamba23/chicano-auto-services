// Erreurs métier CRM (Phase 10) — même discipline que chaque domaine
// précédent (billing/maintenance/work-orders/...) : classes dédiées,
// jamais de stack Prisma brute exposée (voir src/lib/http.ts).

export class CustomerNotFoundError extends Error {
  constructor() {
    super("Client introuvable.");
    this.name = "CustomerNotFoundError";
  }
}

export class CampaignNotFoundError extends Error {
  constructor() {
    super("Campagne introuvable.");
    this.name = "CampaignNotFoundError";
  }
}

export class CampaignConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignConflictError";
  }
}

export class CarePlanNotFoundError extends Error {
  constructor() {
    super("Plan CHICANO CARE introuvable.");
    this.name = "CarePlanNotFoundError";
  }
}

export class CareSubscriptionNotFoundError extends Error {
  constructor() {
    super("Abonnement CHICANO CARE introuvable.");
    this.name = "CareSubscriptionNotFoundError";
  }
}

export class CareConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareConflictError";
  }
}

export class FollowUpNotFoundError extends Error {
  constructor() {
    super("Relance introuvable.");
    this.name = "FollowUpNotFoundError";
  }
}

export class FollowUpConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FollowUpConflictError";
  }
}

export class ReferralConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferralConflictError";
  }
}

export class ConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentError";
  }
}
