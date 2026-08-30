// Abstraction de paiement (Phase 9) — même principe que MessagingProvider/
// StorageProvider/MapProvider : ne jamais enfermer le code dans un
// intégrateur unique, ni simuler une confirmation qui ne s'est pas
// réellement produite.

export type PaymentInitiationStatus = "CONFIRMED" | "NOT_CONFIGURED" | "FAILED";

export interface PaymentInitiationResult {
  status: PaymentInitiationStatus;
  transactionReference?: string;
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(params: { amount: number; customerPhone: string; invoiceNumber: string }): Promise<PaymentInitiationResult>;
}
