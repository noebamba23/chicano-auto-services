import type { NotificationEvent } from "@prisma/client";

// Correspondance NotificationEvent → template WhatsApp Meta approuvé —
// délibérément un mapping en code, pas une colonne Prisma sur
// NotificationTemplate : aucune UI n'édite NotificationTemplate à
// l'exécution aujourd'hui (seedé depuis prisma/seed.ts), un champ DB
// n'apporterait donc aucune flexibilité opérationnelle réelle par rapport
// à ce mapping — à reconsidérer si une gestion des templates par écran
// admin est construite un jour.
//
// NotificationTemplate.bodyTemplate reste la seule source du texte libre
// utilisé en mode mock (voir sendNotification() dans ./service.ts) — cette
// table ne couvre que le sous-ensemble d'événements déjà approuvés côté
// Meta Business Manager. Absence d'entrée, ou templateName vide, = pas
// encore de template Meta pour cet événement : aucun repli silencieux vers
// sendText() en mode meta, l'échec est explicite (voir sendNotification()).
interface MetaTemplateMapping {
  templateName: string;
  // Ordre positionnel exact attendu par le template Meta approuvé — doit
  // correspondre aux {{n}} du template tel que soumis à Meta.
  paramKeys: string[];
}

export const META_TEMPLATE_MAP: Partial<Record<NotificationEvent, MetaTemplateMapping>> = {
  REQUEST_RECEIVED: {
    templateName: process.env.WHATSAPP_META_TEMPLATE_REQUEST_RECEIVED ?? "",
    paramKeys: ["reference"],
  },
};
