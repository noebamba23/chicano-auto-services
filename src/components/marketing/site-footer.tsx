export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-chicano-black text-chicano-gray-light/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-bold text-chicano-white">CHICANO AUTO SERVICES</p>
            <p className="mt-2 text-sm">
              Diagnostic instrumenté, entretien, réparation et assistance automobile à Bamako.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-chicano-white">Services</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Diagnostic automobile</li>
              <li>Entretien &amp; réparation</li>
              <li>Électricité automobile</li>
              <li>Expertise avant achat</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-chicano-white">Entreprise</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Assistance</li>
              <li>Service mobile</li>
              <li>Flottes &amp; B2B</li>
              <li>CHICANO Network</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-chicano-white">Localisation</p>
            <p className="mt-2 text-sm">Bamako, Mali</p>
            <p className="mt-1 text-sm">WhatsApp : disponible depuis votre espace client</p>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-chicano-gray">
          © {new Date().getFullYear()} CHICANO AUTO SERVICES — Nous diagnostiquons avant de réparer.
        </p>
      </div>
    </footer>
  );
}
