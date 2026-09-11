import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";
import { CONTACT_LINKS } from "@/config/contact";
import {
  IconArrowRight,
  IconBolt,
  IconChartBar,
  IconClipboardCheck,
  IconDocumentText,
  IconGauge,
  IconHistory,
  IconKey,
  IconLifeBuoy,
  IconMapPin,
  IconSearchCheck,
  IconShieldCheck,
  IconTruckCheck,
  IconUserCheck,
  IconVan,
  IconWrench,
  IconWrenchScrewdriver,
} from "@/components/marketing/icons";

const REASSURANCE = [
  { icon: IconGauge, label: "Diagnostic instrumenté" },
  { icon: IconVan, label: "Intervention mobile" },
  { icon: IconDocumentText, label: "Rapport de diagnostic" },
  { icon: IconClipboardCheck, label: "Devis avant réparation" },
  { icon: IconHistory, label: "Historique numérique du véhicule" },
];

const STEPS = [
  {
    icon: IconClipboardCheck,
    title: "Demande",
    body: "Décrivez votre besoin depuis votre téléphone : diagnostic, entretien, réparation ou urgence.",
  },
  {
    icon: IconMapPin,
    title: "Rendez-vous",
    body: "Choisissez garage ou intervention mobile, votre créneau, puis validation par CHICANO.",
  },
  {
    icon: IconGauge,
    title: "Diagnostic",
    body: "Notre technicien réalise un diagnostic instrumenté et documente chaque contrôle.",
  },
  {
    icon: IconDocumentText,
    title: "Rapport & devis",
    body: "Vous recevez un rapport écrit, puis un devis détaillé à valider avant toute réparation.",
  },
  {
    icon: IconShieldCheck,
    title: "Réparation tracée",
    body: "La réparation ne démarre qu'après votre accord. Tout est historisé dans votre carnet numérique.",
  },
];

const SERVICES = [
  { icon: IconGauge, title: "Diagnostic", desc: "Diagnostic instrumenté avant toute intervention.", featured: true },
  { icon: IconWrench, title: "Entretien", desc: "Vidange, filtres, freins, contrôles périodiques." },
  { icon: IconWrenchScrewdriver, title: "Réparation", desc: "Mécanique, transmission, suspension, direction." },
  { icon: IconBolt, title: "Électricité automobile", desc: "Diagnostic électrique et électronique embarqué." },
  { icon: IconKey, title: "Programmation clé", desc: "Duplication et programmation de clés véhicule." },
  { icon: IconSearchCheck, title: "Expertise avant achat", desc: "Inspection complète avant l'achat d'un véhicule." },
  { icon: IconLifeBuoy, title: "Assistance", desc: "Intervention en cas de panne ou d'immobilisation." },
  { icon: IconVan, title: "Service mobile", desc: "CHICANO vient à vous, où que vous soyez à Bamako." },
];

const MOBILE_FLOW = [
  { icon: IconMapPin, label: "Localisation" },
  { icon: IconUserCheck, label: "Technicien affecté" },
  { icon: IconWrench, label: "Intervention" },
  { icon: IconHistory, label: "Suivi" },
  { icon: IconDocumentText, label: "Rapport" },
  { icon: IconTruckCheck, label: "Restitution" },
];

const CARNET_ENTRIES = [
  { icon: IconGauge, label: "Diagnostic effectué" },
  { icon: IconWrench, label: "Entretien programmé" },
  { icon: IconShieldCheck, label: "Réparation tracée" },
  { icon: IconClipboardCheck, label: "Rappel d'entretien" },
];

const CARNET_BENEFITS = [
  { icon: IconHistory, title: "Traçabilité", desc: "Chaque intervention reste consultable, dans l'ordre." },
  { icon: IconClipboardCheck, title: "Historique", desc: "Diagnostics, rapports, devis et réparations centralisés." },
  { icon: IconWrench, title: "Entretien", desc: "Les rappels d'entretien sont rattachés au véhicule." },
  { icon: IconChartBar, title: "Suivi", desc: "Vue d'ensemble de ce qui a été fait, et quand." },
  { icon: IconSearchCheck, title: "Connaissance du véhicule", desc: "Un dossier technique qui s'enrichit à chaque visite." },
];

const FLEET_BENEFITS = [
  { icon: IconVan, title: "Suivi des véhicules", desc: "Chaque véhicule de la flotte identifié et suivi individuellement." },
  { icon: IconHistory, title: "Historique des interventions", desc: "Toutes les interventions consultables par véhicule." },
  { icon: IconChartBar, title: "Suivi des coûts", desc: "Visibilité sur les devis et factures par véhicule." },
  { icon: IconWrench, title: "Maintenance programmée", desc: "Rappels d'entretien plutôt que des pannes évitables." },
  { icon: IconDocumentText, title: "Reporting", desc: "Rapports de diagnostic documentés pour chaque intervention." },
  { icon: IconShieldCheck, title: "Traçabilité", desc: "Un historique complet, opposable, par véhicule." },
];

const WHY_PILLARS = [
  {
    icon: IconGauge,
    title: "Diagnostic précis",
    desc: "Un diagnostic instrumenté avant toute décision — jamais l'inverse.",
  },
  {
    icon: IconShieldCheck,
    title: "Réparation tracée",
    desc: "Chaque étape de la réparation est documentée, du début à la fin.",
  },
  {
    icon: IconHistory,
    title: "Historique numérique",
    desc: "Diagnostics, devis et réparations conservés dans le carnet de votre véhicule.",
  },
  {
    icon: IconWrenchScrewdriver,
    title: "Expertise automobile",
    desc: "Diagnostic, entretien, réparation, électricité, assistance — sous un même toit.",
  },
];

const TRUST_PROOFS = [
  { icon: IconGauge, label: "Diagnostic avant réparation" },
  { icon: IconHistory, label: "Historique numérique" },
  { icon: IconShieldCheck, label: "Interventions tracées" },
  { icon: IconUserCheck, label: "Techniciens spécialisés" },
  { icon: IconChartBar, label: "Suivi des opérations" },
];

function Eyebrow({ children, tone = "red" }: { children: React.ReactNode; tone?: "red" | "white" }) {
  return (
    <p
      className={`text-sm font-semibold uppercase tracking-widest ${
        tone === "red" ? "text-chicano-red" : "text-chicano-white/70"
      }`}
    >
      {children}
    </p>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden bg-chicano-black text-chicano-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.15fr] lg:gap-8 lg:px-8 lg:py-0 xl:gap-12">
            <div className="relative z-10 lg:py-20">
              {/* Rouge éclairci (--chicano-red-bright) : le rouge CHICANO
                  standard tombe à 4.01:1 sur ce fond noir, sous le seuil
                  WCAG AA (4.5:1) pour ce texte de petite taille. */}
              <p className="text-sm font-semibold text-chicano-red-bright uppercase tracking-widest">
                Diagnostic automobile de précision — Bamako
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight sm:text-6xl">
                Votre véhicule parle.
                <br />
                <span className="text-chicano-red">CHICANO</span> l&apos;écoute.
              </h1>
              <p className="mt-6 max-w-lg text-lg text-chicano-gray-light/80">
                Un diagnostic précis avant toute réparation. Des interventions tracées. Un historique
                numérique de votre véhicule.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/inscription"
                  className="rounded-md bg-chicano-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-chicano-red/20 transition hover:bg-chicano-red-dark"
                >
                  DEMANDER UN DIAGNOSTIC
                </Link>
                <Link
                  href="/urgence"
                  className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-chicano-white transition hover:bg-white/10"
                >
                  🚨 URGENCE
                </Link>
              </div>
              <p className="mt-8 text-sm text-chicano-gray-light/60">
                Diagnostic <span aria-hidden="true">•</span> Rapport <span aria-hidden="true">•</span> Devis{" "}
                <span aria-hidden="true">•</span> Réparation tracée
              </p>
              <p className="mt-6 text-xs font-medium tracking-widest text-chicano-gray-light/50 uppercase">
                Plus qu&apos;un garage, un partenaire pour la route.
              </p>
            </div>

            {/* Photographie CHICANO — diagnostic capot ouvert */}
            <div className="relative -mx-4 h-72 sm:-mx-6 sm:h-96 lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:h-auto lg:w-[56%] xl:w-[58%]">
              <Image
                src="/hero-diagnostic.png"
                alt="Technicien CHICANO AUTO SERVICES réalisant un diagnostic électronique, capot ouvert, moteur visible, à Bamako"
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover object-[65%_45%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-chicano-black via-chicano-black/10 to-transparent lg:bg-gradient-to-r lg:from-chicano-black lg:via-chicano-black/10 lg:to-transparent" />
            </div>
          </div>
        </section>

        {/* RÉASSURANCE */}
        <section className="border-b border-white/5 bg-chicano-black-soft text-chicano-white">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-center">
              {REASSURANCE.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm text-chicano-gray-light/80">
                  <item.icon className="h-4 w-4 text-chicano-red" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* POURQUOI CHICANO */}
        <section id="pourquoi-chicano" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <Eyebrow>Notre approche</Eyebrow>
            <h2 className="mt-2 max-w-2xl text-2xl font-bold text-chicano-black sm:text-3xl">
              Nous diagnostiquons avant de réparer.
            </h2>
            <p className="mt-4 max-w-2xl text-chicano-gray">
              Chez CHICANO, une réparation commence par la compréhension du problème.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_PILLARS.map((item, i) => (
              <Reveal key={item.title} delayMs={i * 80}>
                <div className="h-full rounded-lg border border-chicano-gray-light p-5">
                  <span className="text-xs font-bold text-chicano-red">{String(i + 1).padStart(2, "0")}</span>
                  <item.icon className="mt-2 h-6 w-6 text-chicano-red" />
                  <p className="mt-3 font-semibold text-chicano-black">{item.title}</p>
                  <p className="mt-1 text-sm text-chicano-gray">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section id="comment-ca-marche" className="bg-chicano-gray-light">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
              <Reveal>
                <div className="relative h-72 overflow-hidden rounded-lg sm:h-96 lg:h-full lg:min-h-[380px]">
                  <Image
                    src="/hero-diagnostic-alt.png"
                    alt="Technicien CHICANO AUTO SERVICES au diagnostic électronique, capot ouvert, atelier premium"
                    fill
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </Reveal>

              <div>
                <Reveal>
                  <Eyebrow>Le parcours CHICANO</Eyebrow>
                  <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">Comment ça marche</h2>
                  <p className="mt-2 max-w-2xl text-chicano-gray">
                    Diagnostic → preuve → rapport → devis → validation client → réparation → traçabilité.
                  </p>
                </Reveal>

                <ol className="relative mt-10 grid gap-4 sm:grid-cols-2">
                  {STEPS.map((step, i) => (
                    <Reveal key={step.title} delayMs={i * 70}>
                      <li className="h-full rounded-lg border border-chicano-gray-light bg-chicano-white p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chicano-black text-xs font-bold text-white">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <step.icon className="h-5 w-5 text-chicano-red" />
                        </div>
                        <p className="mt-3 font-semibold text-chicano-black">{step.title}</p>
                        <p className="mt-1 text-sm text-chicano-gray">{step.body}</p>
                      </li>
                    </Reveal>
                  ))}
                </ol>

                <div className="mt-8">
                  <Link
                    href="/inscription"
                    className="inline-flex items-center gap-2 rounded-md bg-chicano-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-chicano-black-soft"
                  >
                    Démarrer une demande
                    <IconArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NOS SERVICES */}
        <section id="services" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <Eyebrow>Ce que fait CHICANO</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">Nos services</h2>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service, i) => (
              <Reveal key={service.title} delayMs={i * 50} className="h-full">
                <Link
                  href="/inscription"
                  className={`group flex h-full flex-col rounded-lg p-5 shadow-sm transition hover:shadow-md ${
                    service.featured
                      ? "bg-chicano-black text-white ring-1 ring-chicano-red/40"
                      : "bg-white text-chicano-black"
                  }`}
                >
                  <service.icon className="h-7 w-7 text-chicano-red" />
                  <p className="mt-4 font-semibold">{service.title}</p>
                  <p className={`mt-1 text-sm ${service.featured ? "text-white/70" : "text-chicano-gray"}`}>
                    {service.desc}
                  </p>
                  {service.featured && (
                    <span className="mt-3 inline-block w-fit rounded-full bg-chicano-red/15 px-2.5 py-1 text-xs font-semibold text-chicano-red">
                      Point de départ
                    </span>
                  )}
                  <span
                    className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${
                      service.featured ? "text-white" : "text-chicano-black"
                    } opacity-0 transition group-hover:opacity-100`}
                  >
                    Démarrer <IconArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <div className="relative h-64 overflow-hidden rounded-lg sm:h-80">
              <Image
                src="/atelier-vue-ensemble.png"
                alt="Atelier CHICANO AUTO SERVICES : techniciens au travail sur plusieurs véhicules, ponts élévateurs, équipement professionnel"
                fill
                sizes="(min-width: 1024px) 1152px, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </section>

        {/* INTERVENTION MOBILE */}
        <section id="intervention-mobile" className="bg-chicano-gray-light">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Reveal>
              <Eyebrow>Intervention mobile</Eyebrow>
              <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">
                CHICANO vient jusqu&apos;à votre véhicule.
              </h2>
              <p className="mt-4 max-w-2xl text-chicano-gray">
                Localisation précise, technicien affecté, suivi de chaque étape — de la demande jusqu&apos;à
                la restitution du véhicule.
              </p>
              <p className="mt-3 max-w-2xl font-medium text-chicano-black">
                Pas besoin de déplacer votre véhicule lorsque l&apos;intervention mobile est adaptée.
              </p>
            </Reveal>

            <Reveal className="mt-12">
              <div className="flex flex-wrap items-stretch gap-3">
                {MOBILE_FLOW.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="flex w-32 flex-col items-center gap-2 rounded-lg border border-chicano-gray-light bg-chicano-white p-4 text-center">
                      <step.icon className="h-6 w-6 text-chicano-red" />
                      <p className="text-xs font-semibold text-chicano-black">{step.label}</p>
                    </div>
                    {i < MOBILE_FLOW.length - 1 && (
                      <IconArrowRight className="hidden h-4 w-4 shrink-0 text-chicano-gray sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/inscription"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-chicano-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-chicano-red/20 transition hover:bg-chicano-red-dark"
              >
                DEMANDER UNE INTERVENTION
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={CONTACT_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-chicano-gray-light px-6 py-3 text-sm font-semibold text-chicano-black transition hover:bg-chicano-gray-light"
              >
                💬 CONTACTER SUR WHATSAPP
              </a>
            </div>
          </div>
        </section>

        {/* CARNET NUMÉRIQUE */}
        <section id="carnet-numerique" className="bg-chicano-black text-chicano-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
              <Reveal>
                <Eyebrow tone="white">Carnet numérique</Eyebrow>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Votre véhicule possède désormais une mémoire.
                </h2>
                <p className="mt-4 max-w-lg text-chicano-gray-light/80">
                  Retrouvez l&apos;historique des diagnostics, entretiens, réparations et interventions de
                  votre véhicule.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {CARNET_BENEFITS.slice(0, 4).map((item) => (
                    <div key={item.title} className="rounded-lg border border-white/10 p-4">
                      <item.icon className="h-5 w-5 text-chicano-red" />
                      <p className="mt-2 text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-chicano-gray-light/70">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link
                    href="/espace-client"
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Découvrir mon espace client
                    <IconArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Reveal>

              {/* Illustration — aperçu du carnet numérique (mockup d'interface, pas une donnée réelle) */}
              <Reveal delayMs={100}>
                <div className="rounded-2xl border border-white/10 bg-chicano-black-soft p-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <p className="text-sm font-semibold">Carnet numérique du véhicule</p>
                    <IconHistory className="h-5 w-5 text-chicano-red" />
                  </div>
                  <ul className="mt-4 space-y-3">
                    {CARNET_ENTRIES.map((entry) => (
                      <li key={entry.label} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                        <entry.icon className="h-4 w-4 shrink-0 text-chicano-red" />
                        <span className="text-sm text-chicano-gray-light/90">{entry.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ENTREPRISES & FLOTTES */}
        <section id="entreprises" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal className="order-2 lg:order-1">
              <div className="relative h-64 overflow-hidden rounded-lg sm:h-80 lg:h-full lg:min-h-[420px]">
                <Image
                  src="/flotte-entreprises.png"
                  alt="Flotte de véhicules professionnels CHICANO AUTO SERVICES et techniciens devant l'atelier à Bamako"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>

            <Reveal className="order-1 lg:order-2" delayMs={100}>
              <Eyebrow>Pour les entreprises</Eyebrow>
              <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">
                La maintenance automobile pensée pour les entreprises.
              </h2>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {FLEET_BENEFITS.map((item) => (
                  <div key={item.title} className="rounded-lg border border-chicano-gray-light p-4">
                    <item.icon className="h-5 w-5 text-chicano-red" />
                    <p className="mt-2 text-sm font-semibold text-chicano-black">{item.title}</p>
                    <p className="mt-1 text-xs text-chicano-gray">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  href="/inscription"
                  className="inline-flex items-center gap-2 rounded-md bg-chicano-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-chicano-black-soft"
                >
                  GÉRER MA FLOTTE
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CONFIANCE */}
        <section id="confiance" className="bg-chicano-gray-light">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Reveal>
              <Eyebrow>Confiance</Eyebrow>
              <h2 className="mt-2 max-w-2xl text-2xl font-bold text-chicano-black sm:text-3xl">
                Pourquoi les conducteurs choisissent CHICANO
              </h2>
            </Reveal>

            <Reveal className="mt-10">
              <ul className="flex flex-wrap gap-x-10 gap-y-5">
                {TRUST_PROOFS.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm font-medium text-chicano-black">
                    <item.icon className="h-5 w-5 text-chicano-red" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section id="cta-final" className="bg-chicano-black text-chicano-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Votre voiture mérite mieux qu&apos;une réparation au hasard.
            </h2>
            <p className="mt-4 text-chicano-gray-light/80">
              Diagnostiquez. Comprenez. Décidez. Réparez avec CHICANO.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/inscription"
                className="rounded-md bg-chicano-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-chicano-red/20 transition hover:bg-chicano-red-dark"
              >
                DEMANDER UN DIAGNOSTIC
              </Link>
              <Link
                href="/#contact"
                className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-chicano-white transition hover:bg-white/10"
              >
                NOUS CONTACTER
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
