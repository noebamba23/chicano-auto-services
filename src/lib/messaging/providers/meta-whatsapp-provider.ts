import type { WhatsAppProvider } from "../whatsapp-provider";
import type { MessageSendResult } from "../provider";

const GRAPH_API_VERSION = "v21.0";

// Intégration réelle Meta WhatsApp Business Platform (Cloud API). Section 9 :
// ce n'est qu'une des implémentations possibles de WhatsAppProvider — un
// autre BSP (Twilio, 360dialog, etc.) implémenterait la même interface sans
// toucher au reste de l'application.
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = "whatsapp-meta" as const;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string
  ) {}

  async sendText(to: string, body: string): Promise<MessageSendResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace("+", ""),
            type: "text",
            text: { body },
          }),
        }
      );

      const json = (await res.json()) as {
        messages?: { id: string }[];
        error?: { message: string };
      };

      if (!res.ok) {
        return { success: false, error: json.error?.message ?? `HTTP ${res.status}` };
      }

      return { success: true, providerMessageId: json.messages?.[0]?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    params: Record<string, string>
  ): Promise<MessageSendResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace("+", ""),
            type: "template",
            template: {
              name: templateName,
              language: { code: "fr" },
              components: [
                {
                  type: "body",
                  parameters: Object.values(params).map((text) => ({ type: "text", text })),
                },
              ],
            },
          }),
        }
      );

      const json = (await res.json()) as {
        messages?: { id: string }[];
        error?: { message: string };
      };

      if (!res.ok) {
        return { success: false, error: json.error?.message ?? `HTTP ${res.status}` };
      }

      return { success: true, providerMessageId: json.messages?.[0]?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
    }
  }
}
