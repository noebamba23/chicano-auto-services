// Coordonnées officielles de CHICANO AUTO SERVICES — source unique pour tout
// le site public (header, footer, section contact, CTA WhatsApp, SEO/JSON-LD).
// Un futur changement (l'e-mail notamment, susceptible d'évoluer) se fait ici
// uniquement.
export const CONTACT = {
  phone: "+223 60 05 26 26",
  whatsapp: "+223 60 05 26 26",
  email: "alaskeita1@gmail.com",
  address: {
    locality: "Banacoro",
    route: "Route de Sikasso",
    city: "Bamako",
    country: "Mali",
  },
} as const;

// Numéro au format international sans espaces — requis par les liens tel:/wa.me.
export const PHONE_DIGITS = CONTACT.phone.replace(/\s+/g, "");
export const WHATSAPP_DIGITS = CONTACT.whatsapp.replace(/\s+/g, "").replace("+", "");

export const CONTACT_LINKS = {
  tel: `tel:${PHONE_DIGITS}`,
  mailto: `mailto:${CONTACT.email}`,
  whatsapp: `https://wa.me/${WHATSAPP_DIGITS}`,
} as const;

export const ADDRESS_LINES = [
  `${CONTACT.address.locality}, ${CONTACT.address.route}`,
  `${CONTACT.address.city}, ${CONTACT.address.country}`,
] as const;
