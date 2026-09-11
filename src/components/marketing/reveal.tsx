"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Micro-animation légère (section 18 du brief) : révèle son contenu au
// scroll, via IntersectionObserver — aucune dépendance d'animation ajoutée.
// Rendu serveur et no-JS toujours entièrement visibles (état initial
// "visible", jamais caché par défaut) : au montage, on ne bascule en
// "invisible" que si l'élément n'est pas déjà dans le viewport, pour éviter
// tout flash et ne jamais pénaliser SEO/lecteurs d'écran/JS désactivé.
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = node.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyInView) return;

    setVisible(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className ?? ""}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
