import type { PaymentProvider, PaymentInitiationResult } from "../provider";

// Orange Money / Moov Money / Wave — AUCUNE intégration API réelle dans
// cette phase (pas de credentials/configuration). Retourne explicitement
// NOT_CONFIGURED, jamais CONFIRMED : ne jamais enregistrer un faux paiement
// comme abouti (voir docs/BILLING.md, section "Mobile Money").
export class MobileMoneyStubProvider implements PaymentProvider {
  constructor(readonly name: string) {}

  async initiate(): Promise<PaymentInitiationResult> {
    return {
      status: "NOT_CONFIGURED",
      message: `${this.name} n'est pas encore connecté (aucune intégration API réelle dans cette phase).`,
    };
  }
}
