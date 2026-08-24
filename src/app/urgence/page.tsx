import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function UrgencePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-chicano-gray-light px-4 py-24">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-3xl">🚨</p>
          <h1 className="mt-4 text-xl font-bold text-chicano-black">Demande d&apos;intervention urgente</h1>
          <p className="mt-2 text-sm text-chicano-gray">
            Le parcours de demande urgente (géolocalisation, description de la panne, qualification
            CHICANO) arrive très prochainement. Créez votre compte dès maintenant pour être prêt.
          </p>
          <Link
            href="/inscription"
            className="mt-6 inline-block rounded-md bg-chicano-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark"
          >
            Créer mon compte
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
