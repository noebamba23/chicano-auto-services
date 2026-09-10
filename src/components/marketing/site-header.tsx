import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";

const NAV_LINKS = [
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/#services", label: "Nos services" },
  { href: "/#intervention-mobile", label: "Intervention mobile" },
  { href: "/#entreprises", label: "Entreprises" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-chicano-black/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/chicano-logo.png"
            alt="CHICANO AUTO SERVICES"
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-sm font-bold tracking-wide text-chicano-white sm:text-base">
            CHICANO AUTO SERVICES
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex xl:gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-chicano-gray-light/80 transition hover:text-chicano-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/inscription"
            className="hidden rounded-md bg-chicano-white px-3 py-2 text-sm font-semibold text-chicano-black transition hover:bg-chicano-gray-light 2xl:block"
          >
            Demander un diagnostic
          </Link>
          <Link
            href="/connexion"
            className="hidden text-sm font-medium text-chicano-white/90 hover:text-chicano-white lg:block"
          >
            Connexion
          </Link>
          <Link
            href="/inscription"
            className="hidden rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-chicano-white transition hover:bg-white/10 lg:block"
          >
            Créer un compte
          </Link>
          <Link
            href="/urgence"
            className="rounded-md bg-chicano-red px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-chicano-red-dark"
          >
            🚨 Urgence
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
