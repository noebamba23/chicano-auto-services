import Link from "next/link";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-chicano-black text-chicano-gray-light/70">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-sm font-bold tracking-wide text-chicano-white">CHICANO AUTO SERVICES</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed">
              Diagnostic instrumenté, entretien, réparation et assistance automobile à Bamako. Nous
              diagnostiquons avant de réparer.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-chicano-white">Services</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/#services" className="transition hover:text-chicano-white">
                  Diagnostic
                </Link>
              </li>
              <li>
                <Link href="/#services" className="transition hover:text-chicano-white">
                  Entretien &amp; réparation
                </Link>
              </li>
              <li>
                <Link href="/#services" className="transition hover:text-chicano-white">
                  Électricité automobile
                </Link>
              </li>
              <li>
                <Link href="/#services" className="transition hover:text-chicano-white">
                  Expertise avant achat
                </Link>
              </li>
              <li>
                <Link href="/#intervention-mobile" className="transition hover:text-chicano-white">
                  Intervention mobile
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-chicano-white">Entreprise</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/#services" className="transition hover:text-chicano-white">
                  Assistance
                </Link>
              </li>
              <li>
                <Link href="/#intervention-mobile" className="transition hover:text-chicano-white">
                  Service mobile
                </Link>
              </li>
              <li>
                <Link href="/#entreprises" className="transition hover:text-chicano-white">
                  Flottes &amp; B2B
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-chicano-white">Client</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/connexion" className="transition hover:text-chicano-white">
                  Connexion
                </Link>
              </li>
              <li>
                <Link href="/inscription" className="transition hover:text-chicano-white">
                  Créer un compte
                </Link>
              </li>
              <li>
                <Link href="/espace-client/vehicules" className="transition hover:text-chicano-white">
                  Mes véhicules
                </Link>
              </li>
              <li>
                <Link href="/espace-client/demandes" className="transition hover:text-chicano-white">
                  Mes demandes
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="text-sm font-semibold text-chicano-white">Localisation</p>
          <p className="mt-2 text-sm">Banankoro, Route de Sikasso, Bamako</p>
          <p className="mt-1 text-sm">WhatsApp : disponible depuis votre espace client</p>
        </div>

        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-chicano-gray">
          © {new Date().getFullYear()} CHICANO AUTO SERVICES — Nous diagnostiquons avant de réparer.
        </p>
      </div>
    </footer>
  );
}
