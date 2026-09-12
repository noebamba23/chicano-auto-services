import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";

const NAV_LINKS = [
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/#services", label: "Nos services" },
  { href: "/#intervention-mobile", label: "Intervention mobile" },
  { href: "/#entreprises", label: "Entreprises" },
  { href: "/contact", label: "Contact" },
  { href: "/connexion", label: "Connexion" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-chicano-black/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/chicano-logo.png"
            alt="CHICANO AUTO SERVICES"
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="hidden text-sm font-bold tracking-wide whitespace-nowrap text-chicano-white sm:inline lg:hidden">
            CHICANO AUTO SERVICES
          </span>
          <span className="hidden text-sm font-bold tracking-wide text-chicano-white lg:inline">
            CHICANO
          </span>
        </Link>

        <div className="hidden items-center gap-3 lg:flex xl:gap-8">
          <nav className="flex items-center gap-2.5 xl:gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs whitespace-nowrap text-chicano-gray-light/80 transition hover:text-chicano-white xl:text-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/inscription"
              className="rounded-md bg-chicano-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-chicano-black transition hover:bg-chicano-gray-light xl:text-sm"
            >
              <span className="xl:hidden">DIAGNOSTIC</span>
              <span className="hidden xl:inline">DEMANDER UN DIAGNOSTIC</span>
            </Link>
            <Link
              href="/urgence"
              className="rounded-md bg-chicano-red px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-chicano-red-dark xl:text-sm"
            >
              🚨 URGENCE
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/urgence"
            className="flex min-h-11 items-center rounded-md bg-chicano-red px-3 py-3 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-chicano-red-dark"
          >
            🚨 URGENCE
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
