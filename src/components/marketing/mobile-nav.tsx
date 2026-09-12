"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu, IconClose } from "./icons";

const NAV_LINKS = [
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/#services", label: "Nos services" },
  { href: "/#intervention-mobile", label: "Intervention mobile" },
  { href: "/#entreprises", label: "Entreprises" },
  { href: "/#contact", label: "Contact" },
  { href: "/connexion", label: "Connexion" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="flex h-11 w-11 items-center justify-center rounded-md text-chicano-white transition hover:bg-white/10"
      >
        {open ? <IconClose className="h-6 w-6" /> : <IconMenu className="h-6 w-6" />}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-16 border-b border-white/10 bg-chicano-black px-4 py-4 shadow-lg"
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-md px-3 py-3 text-sm font-medium text-chicano-gray-light/90 transition hover:bg-white/10 hover:text-chicano-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-white/10 pt-3">
            <Link
              href="/inscription"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-md bg-chicano-white px-3 py-3 text-center text-sm font-semibold text-chicano-black transition hover:bg-chicano-gray-light"
            >
              DEMANDER UN DIAGNOSTIC
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
