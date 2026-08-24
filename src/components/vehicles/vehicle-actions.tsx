"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function VehicleActions({ vehicleId, isPrimary }: { vehicleId: string; isPrimary: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"primary" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSetPrimary() {
    setLoading("primary");
    setError(null);
    const res = await fetch(`/api/vehicles/${vehicleId}/set-primary`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible de définir ce véhicule comme principal.");
      setLoading(null);
      return;
    }
    router.refresh();
    setLoading(null);
  }

  async function onArchive() {
    if (!confirm("Archiver ce véhicule ? Il n'apparaîtra plus dans votre liste active.")) return;
    setLoading("archive");
    setError(null);
    const res = await fetch(`/api/vehicles/${vehicleId}/archive`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible d'archiver ce véhicule.");
      setLoading(null);
      return;
    }
    router.push("/espace-client/vehicules");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/espace-client/vehicules/${vehicleId}/modifier`}
          className="rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-black hover:border-chicano-red"
        >
          Modifier
        </Link>
        {!isPrimary && (
          <button
            onClick={onSetPrimary}
            disabled={loading !== null}
            className="rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-black hover:border-chicano-red disabled:opacity-60"
          >
            {loading === "primary" ? "..." : "Définir comme principal"}
          </button>
        )}
        <button
          onClick={onArchive}
          disabled={loading !== null}
          className="rounded-md border border-chicano-gray-light px-4 py-2 text-sm font-medium text-chicano-gray hover:border-chicano-red hover:text-chicano-red disabled:opacity-60"
        >
          {loading === "archive" ? "..." : "Archiver"}
        </button>
      </div>
      {error && <p className="text-sm text-chicano-red">{error}</p>}
    </div>
  );
}
