import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";
import { CONTACT, CONTACT_LINKS, ADDRESS_LINES } from "@/config/contact";

const SITE_URL = "https://chicano-auto-services.vercel.app";
const PAGE_DESCRIPTION =
  "Contactez CHICANO AUTO SERVICES à Bamako pour vos besoins de diagnostic, entretien, réparation et assistance automobile.";

export const metadata: Metadata = {
  title: { absolute: "Contact | CHICANO AUTO SERVICES — Bamako" },
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    type: "website",
    locale: "fr_ML",
    url: `${SITE_URL}/contact`,
    siteName: "CHICANO AUTO SERVICES",
    title: "Contact | CHICANO AUTO SERVICES — Bamako",
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/contact-bamako-premium.jpeg",
        width: 2752,
        height: 1536,
        alt: "CHICANO AUTO SERVICES à Bamako — véhicule devant le Monument de l'Indépendance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | CHICANO AUTO SERVICES — Bamako",
    description: PAGE_DESCRIPTION,
    images: ["/contact-bamako-premium.jpeg"],
  },
};

const CONTACT_CARDS = [
  {
    emoji: "📍",
    label: "Adresse",
    lines: [...ADDRESS_LINES],
    href: undefined as string | undefined,
  },
  {
    emoji: "📞",
    label: "Téléphone",
    lines: [CONTACT.phone],
    href: CONTACT_LINKS.tel,
  },
  {
    emoji: "💬",
    label: "WhatsApp",
    lines: [CONTACT.whatsapp],
    href: CONTACT_LINKS.whatsapp,
  },
  {
    emoji: "✉️",
    label: "E-mail",
    lines: [CONTACT.email],
    href: CONTACT_LINKS.mailto,
  },
];

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* HERO — visuel Bamako premium, ratio source conservé à 100% (aucun crop) */}
        <section className="relative bg-chicano-black text-chicano-white">
          <div className="relative aspect-[2752/1536] w-full overflow-hidden">
            <Image
              src="/contact-bamako-premium.jpeg"
              alt="Berline CHICANO AUTO SERVICES devant le Monument de l'Indépendance de Bamako au coucher du soleil"
              fill
              priority
              sizes="100vw"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          </div>

          <div className="px-4 py-8 sm:absolute sm:inset-x-0 sm:bottom-0 sm:px-8 sm:pt-24 sm:pb-10 lg:px-16 lg:pb-16">
            <div className="mx-auto max-w-7xl">
              <Reveal>
                <p className="text-sm font-semibold text-chicano-red-bright uppercase tracking-widest">
                  Contactez CHICANO
                </p>
                <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Parlons de votre véhicule.
                </h1>
                <p className="mt-4 max-w-lg text-sm text-chicano-gray-light/80 sm:text-base">
                  Une question, un diagnostic, une intervention ou un besoin pour votre flotte ? Notre
                  équipe vous accompagne à Bamako.
                </p>
                <p className="mt-4 text-sm font-medium text-chicano-gray-light/90">
                  {ADDRESS_LINES[0]}
                  <br />
                  {ADDRESS_LINES[1]}
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <a
                    href="#coordonnees"
                    className="inline-flex min-h-11 items-center rounded-md bg-chicano-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-chicano-red/20 transition hover:bg-chicano-red-dark"
                  >
                    NOUS CONTACTER
                  </a>
                  <a
                    href={CONTACT_LINKS.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-chicano-white transition hover:bg-white/10"
                  >
                    💬 WHATSAPP
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* COORDONNÉES */}
        <section id="coordonnees" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-chicano-red">Coordonnées</p>
            <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">
              Toutes les façons de joindre CHICANO
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CONTACT_CARDS.map((card, i) => {
              const content = (
                <>
                  <span className="text-2xl" aria-hidden="true">
                    {card.emoji}
                  </span>
                  <p className="mt-4 text-sm font-semibold text-chicano-black">{card.label}</p>
                  {card.lines.map((line) => (
                    <p key={line} className="mt-1 text-sm text-chicano-gray">
                      {line}
                    </p>
                  ))}
                </>
              );
              return (
                <Reveal key={card.label} delayMs={i * 60}>
                  {card.href ? (
                    <a
                      href={card.href}
                      target={card.href.startsWith("http") ? "_blank" : undefined}
                      rel={card.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex h-full min-h-11 flex-col rounded-lg border border-chicano-gray-light p-6 transition hover:border-chicano-red/40 hover:shadow-sm"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="flex h-full flex-col rounded-lg border border-chicano-gray-light p-6">
                      {content}
                    </div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* BAMAKO, NOTRE TERRAIN */}
        <section className="bg-chicano-gray-light">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-chicano-red">
                Bamako, notre terrain
              </p>
              <p className="mt-4 text-lg font-medium text-chicano-black">
                CHICANO AUTO SERVICES accompagne les automobilistes et les entreprises à Bamako avec une
                approche fondée sur le diagnostic, la précision et la traçabilité.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
