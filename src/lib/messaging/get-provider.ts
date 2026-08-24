import type { WhatsAppProvider } from "./whatsapp-provider";
import { MockWhatsAppProvider } from "./providers/mock-whatsapp-provider";
import { MetaWhatsAppProvider } from "./providers/meta-whatsapp-provider";

let cached: WhatsAppProvider | null = null;

// Sélectionne le fournisseur WhatsApp actif selon la configuration.
// En production, WHATSAPP_PROVIDER_MODE doit valoir "meta" (ou un futur BSP) —
// le mode "mock" reste utilisable en production tant que la ligne WhatsApp
// Business n'est pas raccordée, mais ne doit jamais être présenté au client
// comme un envoi réel (section 8).
export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;

  const mode = process.env.WHATSAPP_PROVIDER_MODE ?? "mock";

  if (mode === "meta") {
    const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) {
      throw new Error(
        "WHATSAPP_PROVIDER_MODE=meta requiert WHATSAPP_META_ACCESS_TOKEN et WHATSAPP_META_PHONE_NUMBER_ID."
      );
    }
    cached = new MetaWhatsAppProvider(accessToken, phoneNumberId);
    return cached;
  }

  cached = new MockWhatsAppProvider();
  return cached;
}

export function isMockWhatsAppActive(): boolean {
  return (process.env.WHATSAPP_PROVIDER_MODE ?? "mock") !== "meta";
}
