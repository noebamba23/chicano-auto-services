import type { MessagingProvider } from "./provider";

// Spécialisation WhatsApp de MessagingProvider. Ne pas enfermer le code dans
// un fournisseur unique (section 9) : toute intégration (Meta WhatsApp
// Business Platform ou un BSP compatible) implémente cette interface.
export interface WhatsAppProvider extends MessagingProvider {
  readonly name: "whatsapp-mock" | "whatsapp-meta" | string;
  sendTemplate?(
    to: string,
    templateName: string,
    params: Record<string, string>
  ): Promise<import("./provider").MessageSendResult>;
}
