"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

type Category = "TOUT" | "DIAGNOSTIC" | "MAINTENANCE" | "REPAIR" | "TECHNICAL_VISIT" | "OTHER";

const FILTERS: { value: Category; label: string }[] = [
  { value: "TOUT", label: "Tout" },
  { value: "DIAGNOSTIC", label: "Diagnostics" },
  { value: "MAINTENANCE", label: "Entretiens" },
  { value: "REPAIR", label: "Réparations" },
  { value: "TECHNICAL_VISIT", label: "Visites techniques" },
  { value: "OTHER", label: "Autres" },
];

const CATEGORY_ICON: Record<string, string> = {
  DIAGNOSTIC: "🔎",
  MAINTENANCE: "🛠",
  REPAIR: "🔧",
  TECHNICAL_VISIT: "📋",
  OTHER: "📄",
};

interface HistoryEvent {
  id: string;
  date: string;
  category: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  technicianName: string | null;
  href: string | null;
}

export function VehicleHistoryTimeline({ vehicleId }: { vehicleId: string }) {
  const [category, setCategory] = useState<Category>("TOUT");
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  // Suivi de la position de pagination via ref plutôt que state : évite un
  // setState synchrone dans l'effet de changement de filtre (voir règle
  // react-hooks/set-state-in-effect).
  const offsetRef = useRef(0);

  const load = useCallback(async (cat: Category, currentOffset: number, append: boolean) => {
    setLoading(true);
    const params = new URLSearchParams({ offset: String(currentOffset), limit: "10" });
    if (cat !== "TOUT") params.set("category", cat);
    const res = await fetch(`/api/vehicles/${vehicleId}/history?${params}`);
    const data = await res.json().catch(() => ({ events: [], hasMore: false }));
    setEvents((prev) => (append ? [...prev, ...(data.events ?? [])] : (data.events ?? [])));
    setHasMore(Boolean(data.hasMore));
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    offsetRef.current = 0;
    // Récupération de données au montage/changement de filtre — pattern
    // standard (load() appelle setLoading en interne). La règle ne
    // distingue pas cet appel effet-vers-fetch d'un vrai setState en boucle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(category, 0, false);
  }, [category, load]);

  function loadMore() {
    offsetRef.current += 10;
    load(category, offsetRef.current, true);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setCategory(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              category === f.value
                ? "bg-chicano-red text-white"
                : "border border-chicano-gray-light text-chicano-black hover:border-chicano-red"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {events.map((event) => {
          const content = (
            <div className="rounded-lg border border-chicano-gray-light bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-chicano-gray">
                  {new Date(event.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
                {event.status && <span className="text-xs font-medium text-chicano-gray">{event.status}</span>}
              </div>
              <p className="mt-1 text-sm font-semibold text-chicano-black">
                {CATEGORY_ICON[event.category] ?? "•"} {event.title}
              </p>
              {event.subtitle && <p className="mt-1 text-sm text-chicano-gray">{event.subtitle}</p>}
              {event.technicianName && <p className="mt-1 text-xs text-chicano-gray">Technicien : {event.technicianName}</p>}
            </div>
          );

          return event.href ? (
            <Link key={event.id} href={event.href} className="block hover:opacity-90">
              {content}
            </Link>
          ) : (
            <div key={event.id}>{content}</div>
          );
        })}

        {!loading && events.length === 0 && (
          <p className="rounded-lg border border-dashed border-chicano-gray-light bg-white p-8 text-center text-sm text-chicano-gray">
            Pas encore d&apos;historique disponible.
          </p>
        )}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mt-4 w-full rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-black hover:border-chicano-red disabled:opacity-60"
        >
          {loading ? "..." : "Charger plus"}
        </button>
      )}
    </div>
  );
}
