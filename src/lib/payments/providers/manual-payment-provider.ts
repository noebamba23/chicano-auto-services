import type { PaymentProvider, PaymentInitiationResult } from "../provider";

// Espèces / virement bancaire / autre — la transaction a déjà eu lieu au
// moment où la production la saisit (attestation directe, pas une API
// externe) : confirmée immédiatement, jamais "en attente".
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";

  async initiate(): Promise<PaymentInitiationResult> {
    return { status: "CONFIRMED" };
  }
}
