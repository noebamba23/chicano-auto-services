import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const STEPS = [
  { title: "Demande", body: "Décrivez votre besoin depuis votre téléphone : diagnostic, entretien, réparation ou urgence." },
  { title: "Rendez-vous", body: "Choisissez garage ou intervention mobile, votre créneau, puis validation par CHICANO." },
  { title: "Diagnostic", body: "Notre technicien réalise un diagnostic instrumenté et documente chaque contrôle." },
  { title: "Rapport & devis", body: "Vous recevez un rapport écrit, puis un devis détaillé à valider avant toute réparation." },
  { title: "Réparation tracée", body: "La réparation ne démarre qu'après votre accord. Tout est historisé dans votre carnet numérique." },
];

const SERVICES = [
  { title: "Diagnostic", desc: "Diagnostic instrumenté avant toute intervention." },
  { title: "Entretien", desc: "Vidange, filtres, freins, contrôles périodiques." },
  { title: "Réparation", desc: "Mécanique, transmission, suspension, direction." },
  { title: "Électricité automobile", desc: "Diagnostic électrique et électronique embarqué." },
  { title: "Programmation clé", desc: "Duplication et programmation de clés véhicule." },
  { title: "Expertise avant achat", desc: "Inspection complète avant l'achat d'un véhicule." },
  { title: "Assistance", desc: "Intervention en cas de panne ou d'immobilisation." },
  { title: "Service mobile", desc: "CHICANO vient à vous, où que vous soyez à Bamako." },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-chicano-black text-chicano-white">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-chicano-red">
              Diagnostic automobile de précision — Bamako
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Votre véhicule parle.
              <br />
              CHICANO l&apos;écoute.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-chicano-gray-light/80">
              Diagnostic automobile de précision, entretien, réparation et assistance à Bamako.
              Nous diagnostiquons avant de réparer.
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
          </div>
        </section>

        <section id="comment-ca-marche" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-chicano-black sm:text-3xl">Comment ça marche</h2>
          <p className="mt-2 max-w-2xl text-chicano-gray">
            Diagnostic → preuve → rapport → devis → validation client → réparation → traçabilité.
          </p>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-chicano-gray-light p-5">
                <span className="text-sm font-bold text-chicano-red">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 font-semibold text-chicano-black">{step.title}</p>
                <p className="mt-1 text-sm text-chicano-gray">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="services" className="bg-chicano-gray-light">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-chicano-black sm:text-3xl">Nos services</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((service) => (
                <div key={service.title} className="rounded-lg bg-white p-5 shadow-sm">
                  <p className="font-semibold text-chicano-black">{service.title}</p>
                  <p className="mt-1 text-sm text-chicano-gray">{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="intervention-mobile" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold text-chicano-black sm:text-3xl">Intervention mobile</h2>
              <p className="mt-4 text-chicano-gray">
                CHICANO vient à vous : localisation précise, technicien affecté, suivi en temps réel de
                chaque étape — de la demande jusqu&apos;à la restitution du véhicule.
              </p>
            </div>
            <div className="rounded-lg border border-chicano-gray-light p-6">
              <p className="font-semibold text-chicano-black">Carnet numérique du véhicule</p>
              <p className="mt-2 text-sm text-chicano-gray">
                Chaque diagnostic, rapport, devis, réparation et rappel d&apos;entretien est conservé dans
                l&apos;historique de votre véhicule, accessible à tout moment depuis votre espace client.
              </p>
            </div>
          </div>
        </section>

        <section id="entreprises" className="bg-chicano-black text-chicano-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold sm:text-3xl">Entreprises &amp; flottes</h2>
            <p className="mt-4 max-w-2xl text-chicano-gray-light/80">
              Gestion de flotte, suivi des coûts, reporting et maintenance programmée pour les entreprises
              maliennes.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
