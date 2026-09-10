// Icônes ligne maison (SVG inline, aucune dépendance ajoutée) — reprennent
// le vocabulaire visuel du logo CHICANO (jauge, clé, éclair, clé à molette).
// Toutes acceptent `className` pour hériter de la couleur/taille via Tailwind.

type IconProps = { className?: string };

function Base({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconGauge({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 13.5 15 10" />
      <circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <path d="M4.5 15.5a8 8 0 1 1 15 0" />
      <path d="M4.5 15.5h2M17.5 15.5h2M12 6.5v2" />
    </Base>
  );
}

export function IconWrench({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M14.7 6.3a4 4 0 0 0-5.3 4.8L4 16.5V20h3.5l5.4-5.4a4 4 0 0 0 4.8-5.3l-2.6 2.6-2-2 2.6-2.6Z" />
    </Base>
  );
}

export function IconWrenchScrewdriver({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M14.7 6.3a4 4 0 0 0-5.3 4.8L4 16.5V20h3.5l5.4-5.4a4 4 0 0 0 4.8-5.3l-2.6 2.6-2-2 2.6-2.6Z" />
      <path d="M17 4l3 3-1.5 1.5L15.5 5.5Z" />
    </Base>
  );
}

export function IconBolt({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M13 3 6 14h5l-1 7 8-12h-5l1-6Z" strokeLinejoin="round" />
    </Base>
  );
}

export function IconKey({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5 19 4M16 7.5l2 2M18.5 5l2 2" />
    </Base>
  );
}

export function IconSearchCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3M8 10.5l1.5 1.5L13 8.5" />
    </Base>
  );
}

export function IconLifeBuoy({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="m6 6 3.5 3.5M18 6l-3.5 3.5M18 18l-3.5-3.5M6 18l3.5-3.5" />
    </Base>
  );
}

export function IconVan({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3 16V8a1 1 0 0 1 1-1h9v9H3Z" />
      <path d="M13 10h4l3 3v3h-7Z" />
      <circle cx="7" cy="17.5" r="1.5" />
      <circle cx="17" cy="17.5" r="1.5" />
    </Base>
  );
}

export function IconMapPin({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </Base>
  );
}

export function IconUserCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="m16 12 1.5 1.5L21 10" />
    </Base>
  );
}

export function IconClipboardCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="m9 13 2 2 4-4" />
    </Base>
  );
}

export function IconDocumentText({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8M8 15.5h8M8 8.5h4" />
    </Base>
  );
}

export function IconHistory({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 8v4.5l3 2" />
    </Base>
  );
}

export function IconChartBar({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M20 20H4" />
    </Base>
  );
}

export function IconTruckCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3 16V7a1 1 0 0 1 1-1h9v10H3Z" />
      <path d="M13 10h4l3 3v3h-7Z" />
      <circle cx="7.5" cy="18" r="1.5" />
      <circle cx="17.5" cy="18" r="1.5" />
      <path d="m6 3 1.5 1.5L10.5 1.5" />
    </Base>
  );
}

export function IconShieldCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Base>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}
