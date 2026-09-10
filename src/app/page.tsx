import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
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
  { icon: IconGauge, label: "Diagnostic" },
  { icon: IconDocumentText, label: "Transparence" },
  { icon: IconHistory, label: "Traçabilité" },
  { icon: IconClipboardCheck, label: "Décision éclairée" },
  { icon: IconShieldCheck, label: "Suivi du véhicule" },
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
              <Eyebrow>Diagnostic automobile de précision — Bamako</Eyebrow>
              <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight sm:text-6xl">
                Votre véhicule parle.
                <br />
                <span className="text-chicano-red">CHICANO</span> l&apos;écoute.
              </h1>
              <p className="mt-6 max-w-lg text-lg text-chicano-gray-light/80">
                Diagnostic automobile de précision, entretien, réparation et assistance à Bamako.
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
              <p className="mt-10 text-xs font-medium tracking-widest text-chicano-gray-light/50 uppercase">
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
          <Eyebrow>Notre approche</Eyebrow>
          <h2 className="mt-2 max-w-2xl text-2xl font-bold text-chicano-black sm:text-3xl">
            Nous diagnostiquons avant de réparer.
          </h2>
          <p className="mt-4 max-w-2xl text-chicano-gray">
            Chaque intervention CHICANO commence par un diagnostic, pas par une réparation. Vous savez ce qui
            ne va pas, ce que ça coûte, et vous décidez — avant que quoi que ce soit ne soit engagé sur votre
            véhicule.
          </p>

          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {WHY_PILLARS.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm font-medium text-chicano-black">
                <item.icon className="h-4 w-4 text-chicano-red" />
                {item.label}
              </li>
            ))}
          </ul>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section id="comment-ca-marche" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Eyebrow>Le parcours CHICANO</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">Comment ça marche</h2>
          <p className="mt-2 max-w-2xl text-chicano-gray">
            Diagnostic → preuve → rapport → devis → validation client → réparation → traçabilité.
          </p>

          <ol className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <div className="absolute top-9 right-0 left-0 hidden h-px bg-chicano-gray-light lg:block" aria-hidden="true" />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative rounded-lg border border-chicano-gray-light bg-chicano-white p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chicano-black text-xs font-bold text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <step.icon className="h-5 w-5 text-chicano-red" />
                </div>
                <p className="mt-4 font-semibold text-chicano-black">{step.title}</p>
                <p className="mt-1 text-sm text-chicano-gray">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link
              href="/inscription"
              className="inline-flex items-center gap-2 rounded-md bg-chicano-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-chicano-black-soft"
            >
              Démarrer une demande
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* NOS SERVICES */}
        <section id="services" className="bg-chicano-gray-light">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Eyebrow>Ce que fait CHICANO</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">Nos services</h2>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((service) => (
                <Link
                  key={service.title}
                  href="/inscription"
                  className={`group flex flex-col rounded-lg p-5 shadow-sm transition hover:shadow-md ${
                    service.featured
                      ? "bg-chicano-black text-white ring-1 ring-chicano-red/40"
                      : "bg-white text-chicano-black"
                  }`}
                >
                  <service.icon
                    className={`h-7 w-7 ${service.featured ? "text-chicano-red" : "text-chicano-red"}`}
                  />
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
              ))}
            </div>

            <div className="relative mt-10 h-64 overflow-hidden rounded-lg sm:h-80">
              <Image
                src="/atelier-vue-ensemble.png"
                alt="Atelier CHICANO AUTO SERVICES : techniciens au travail sur plusieurs véhicules, ponts élévateurs, équipement professionnel"
                fill
                sizes="(min-width: 1024px) 1152px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* INTERVENTION MOBILE */}
        <section id="intervention-mobile" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Eyebrow>Intervention mobile</Eyebrow>
          <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">
            CHICANO vient jusqu&apos;à votre véhicule.
          </h2>
          <p className="mt-4 max-w-2xl text-chicano-gray">
            Localisation précise, technicien affecté, suivi de chaque étape — de la demande jusqu&apos;à la
            restitution du véhicule.
          </p>
          <p className="mt-3 max-w-2xl font-medium text-chicano-black">
            Pas besoin de déplacer votre véhicule lorsque l&apos;intervention mobile est adaptée.
          </p>

          <div className="mt-12 flex flex-wrap items-stretch gap-3">
            {MOBILE_FLOW.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="flex w-32 flex-col items-center gap-2 rounded-lg border border-chicano-gray-light p-4 text-center">
                  <step.icon className="h-6 w-6 text-chicano-red" />
                  <p className="text-xs font-semibold text-chicano-black">{step.label}</p>
                </div>
                {i < MOBILE_FLOW.length - 1 && (
                  <IconArrowRight className="hidden h-4 w-4 shrink-0 text-chicano-gray sm:block" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/inscription"
              className="inline-flex items-center gap-2 rounded-md bg-chicano-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-chicano-red/20 transition hover:bg-chicano-red-dark"
            >
              Demander une intervention mobile
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* CARNET NUMÉRIQUE */}
        <section id="carnet-numerique" className="bg-chicano-black text-chicano-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Eyebrow tone="white">Carnet numérique</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Votre véhicule possède désormais une mémoire.</h2>
            <p className="mt-4 max-w-2xl text-chicano-gray-light/80">
              Chaque diagnostic, rapport, devis, réparation et rappel d&apos;entretien peut être conservé dans
              l&apos;historique de votre véhicule, accessible depuis votre espace client.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {CARNET_BENEFITS.map((item) => (
                <div key={item.title} className="rounded-lg border border-white/10 p-5">
                  <item.icon className="h-6 w-6 text-chicano-red" />
                  <p className="mt-3 font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-chicano-gray-light/70">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <Link
                href="/espace-client"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Découvrir mon espace client
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ENTREPRISES & FLOTTES */}
        <section id="entreprises" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="relative order-2 h-64 overflow-hidden rounded-lg sm:h-80 lg:order-1 lg:h-full lg:min-h-[420px]">
              <Image
                src="/flotte-entreprises.png"
                alt="Flotte de véhicules professionnels CHICANO AUTO SERVICES et techniciens devant l'atelier à Bamako"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>

            <div className="order-1 lg:order-2">
              <Eyebrow>Pour les entreprises</Eyebrow>
              <h2 className="mt-2 text-2xl font-bold text-chicano-black sm:text-3xl">
                Gestion de flotte automobile pour les entreprises maliennes
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
                  PARLER À CHICANO
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section id="cta-final" className="bg-chicano-black text-chicano-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Votre véhicule mérite mieux qu&apos;une réparation au hasard.
            </h2>
            <p className="mt-4 text-chicano-gray-light/80">
              Demandez votre diagnostic et laissez CHICANO vous accompagner avant toute réparation.
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
