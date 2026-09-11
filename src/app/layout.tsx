import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CONTACT, PHONE_DIGITS } from "@/config/contact";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://chicano-auto-services.vercel.app";
const SITE_DESCRIPTION =
  "Diagnostic automobile de précision, entretien, réparation et assistance à Bamako. Nous diagnostiquons avant de réparer.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CHICANO AUTO SERVICES — Diagnostic automobile à Bamako",
    template: "%s — CHICANO AUTO SERVICES",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "CHICANO AUTO SERVICES",
    "garage automobile Bamako",
    "diagnostic automobile Bamako",
    "diagnostic voiture Mali",
    "entretien voiture Bamako",
    "réparation automobile Mali",
    "mécanicien Bamako",
    "service automobile Mali",
    "intervention automobile Bamako",
    "flotte automobile entreprise Mali",
  ],
  openGraph: {
    type: "website",
    locale: "fr_ML",
    url: SITE_URL,
    siteName: "CHICANO AUTO SERVICES",
    title: "CHICANO AUTO SERVICES — Diagnostic automobile à Bamako",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/hero-diagnostic.png",
        width: 1672,
        height: 941,
        alt: "CHICANO AUTO SERVICES — Diagnostic automobile de précision, Bamako, Mali",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CHICANO AUTO SERVICES — Diagnostic automobile à Bamako",
    description: SITE_DESCRIPTION,
    images: ["/hero-diagnostic.png"],
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

// Données structurées minimales (schema.org AutomotiveBusiness) — reflètent
// uniquement les coordonnées réelles centralisées dans src/config/contact.ts,
// aucune donnée inventée (pas d'avis, de note, d'horaires).
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AutomotiveBusiness",
  name: "CHICANO AUTO SERVICES",
  image: `${SITE_URL}/hero-diagnostic.png`,
  url: SITE_URL,
  telephone: PHONE_DIGITS,
  email: CONTACT.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: `${CONTACT.address.locality}, ${CONTACT.address.route}`,
    addressLocality: CONTACT.address.city,
    addressCountry: "ML",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-chicano-white text-chicano-black">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
