"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function VehiclePhotoUploader({ vehicleId, coverUrl }: { vehicleId: string; coverUrl?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/photo`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible d'envoyer la photo.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full sm:w-40">
      <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg bg-chicano-gray-light">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Véhicule" className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl">🚗</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="mt-2 w-full rounded-md border border-chicano-gray-light px-3 py-1.5 text-xs font-medium text-chicano-black hover:border-chicano-red disabled:opacity-60"
      >
        {loading ? "Envoi..." : coverUrl ? "Remplacer la photo" : "Ajouter une photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileSelected}
      />
      {error && <p className="mt-1 text-xs text-chicano-red">{error}</p>}
    </div>
  );
}
