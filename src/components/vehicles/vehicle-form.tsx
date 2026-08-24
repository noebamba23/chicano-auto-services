"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Vehicle } from "@prisma/client";
import { BODY_TYPE_OPTIONS, FUEL_TYPE_OPTIONS, TRANSMISSION_OPTIONS } from "@/lib/vehicles/options";

type Props = {
  vehicle?: Vehicle;
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function VehicleForm({ vehicle }: Props) {
  const router = useRouter();
  const isEdit = Boolean(vehicle);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      make: String(form.get("make") ?? ""),
      model: String(form.get("model") ?? ""),
      trim: String(form.get("trim") ?? ""),
      year: form.get("year") ? Number(form.get("year")) : null,
      bodyType: form.get("bodyType") || null,
      fuelType: String(form.get("fuelType") ?? "OTHER"),
      engine: String(form.get("engine") ?? ""),
      transmission: form.get("transmission") || null,
      licensePlate: String(form.get("licensePlate") ?? ""),
      vin: String(form.get("vin") ?? ""),
      mileage: form.get("mileage") ? Number(form.get("mileage")) : null,
      color: String(form.get("color") ?? ""),
      firstRegisteredAt: String(form.get("firstRegisteredAt") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    try {
      const res = await fetch(isEdit ? `/api/vehicles/${vehicle!.id}` : "/api/vehicles", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      const id = data.vehicle?.id ?? vehicle?.id;
      router.push(`/espace-client/vehicules/${id}`);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Marque" htmlFor="make">
          <input
            id="make"
            name="make"
            required
            defaultValue={vehicle?.make}
            className="input"
          />
        </Field>
        <Field label="Modèle" htmlFor="model">
          <input id="model" name="model" required defaultValue={vehicle?.model} className="input" />
        </Field>
        <Field label="Version" htmlFor="trim">
          <input id="trim" name="trim" defaultValue={vehicle?.trim ?? ""} className="input" />
        </Field>
        <Field label="Année" htmlFor="year">
          <input
            id="year"
            name="year"
            type="number"
            min={1950}
            max={new Date().getFullYear() + 1}
            defaultValue={vehicle?.year ?? ""}
            className="input"
          />
        </Field>
        <Field label="Type de véhicule" htmlFor="bodyType">
          <select id="bodyType" name="bodyType" defaultValue={vehicle?.bodyType ?? ""} className="input">
            <option value="">Non précisé</option>
            {BODY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carburant" htmlFor="fuelType">
          <select id="fuelType" name="fuelType" defaultValue={vehicle?.fuelType ?? "OTHER"} className="input">
            {FUEL_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Motorisation" htmlFor="engine">
          <input
            id="engine"
            name="engine"
            placeholder="ex. 2.4L Turbo Diesel"
            defaultValue={vehicle?.engine ?? ""}
            className="input"
          />
        </Field>
        <Field label="Boîte de vitesses" htmlFor="transmission">
          <select
            id="transmission"
            name="transmission"
            defaultValue={vehicle?.transmission ?? ""}
            className="input"
          >
            <option value="">Non précisée</option>
            {TRANSMISSION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Immatriculation" htmlFor="licensePlate">
          <input
            id="licensePlate"
            name="licensePlate"
            required
            defaultValue={vehicle?.licensePlate ?? ""}
            className="input"
          />
        </Field>
        <Field label="VIN / numéro de châssis" htmlFor="vin" hint="Facultatif si vous ne le connaissez pas">
          <input id="vin" name="vin" defaultValue={vehicle?.vin ?? ""} className="input" />
        </Field>
        <Field label="Kilométrage" htmlFor="mileage">
          <input
            id="mileage"
            name="mileage"
            type="number"
            min={0}
            defaultValue={vehicle?.mileage ?? ""}
            className="input"
          />
        </Field>
        <Field label="Couleur" htmlFor="color">
          <input id="color" name="color" defaultValue={vehicle?.color ?? ""} className="input" />
        </Field>
        <Field label="Date de première mise en circulation" htmlFor="firstRegisteredAt">
          <input
            id="firstRegisteredAt"
            name="firstRegisteredAt"
            type="date"
            defaultValue={dateInputValue(vehicle?.firstRegisteredAt)}
            className="input"
          />
        </Field>
      </fieldset>

      <Field label="Informations complémentaires" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={vehicle?.notes ?? ""} className="input" />
      </Field>

      {error && <p className="text-sm text-chicano-red">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-chicano-red-dark disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Enregistrement..." : isEdit ? "Enregistrer les modifications" : "Ajouter mon véhicule"}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-chicano-black">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-chicano-gray">{hint}</p>}
    </div>
  );
}
