import type { WhatsAppProvider } from "../whatsapp-provider";
import type { MessageSendResult } from "../provider";

// Fournisseur MOCK / DEVELOPMENT — section 8 : ne jamais prétendre que
// WhatsApp est connecté si aucune API réelle n'est configurée. Ce
// fournisseur journalise le message côté serveur uniquement ; il ne doit
// jamais être actif en production (voir get-provider.ts).
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "whatsapp-mock" as const;

  async sendText(to: string, body: string): Promise<MessageSendResult> {
    console.log(
      `[WHATSAPP MOCK] → ${to}\n${body}\n(Ce message n'a pas été envoyé sur un vrai réseau WhatsApp — fournisseur de développement.)`
    );
    return { success: true, providerMessageId: `mock-${Date.now()}` };
  }

  async sendTemplate(
    to: string,
    templateName: string,
    params: Record<string, string>
  ): Promise<MessageSendResult> {
    console.log(
      `[WHATSAPP MOCK] → ${to} (template: ${templateName})\nParamètres : ${JSON.stringify(params)}\n(Ce message n'a pas été envoyé sur un vrai réseau WhatsApp — fournisseur de développement.)`
    );
    return { success: true, providerMessageId: `mock-${Date.now()}` };
  }
}
