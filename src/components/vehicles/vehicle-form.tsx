"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Vehicle } from "@prisma/client";
import { BODY_TYPE_OPTIONS, FUEL_TYPE_OPTIONS, TRANSMISSION_OPTIONS } from "@/lib/vehicles/options";
import { normalizePlateNumber, validatePlateNumber, formatPlateNumber } from "@/lib/vehicles/registration/plate";

type Props = {
  vehicle?: Vehicle;
};

type FieldErrors = Record<string, string[]>;

function dateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function VehicleForm({ vehicle }: Props) {
  const router = useRouter();
  const isEdit = Boolean(vehicle);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [plateInput, setPlateInput] = useState(vehicle?.licensePlate ?? "");

  const platePreview = plateInput ? formatPlateNumber(plateInput) : null;
  const plateValid = plateInput ? validatePlateNumber(plateInput) : true;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const setPrimary = form.get("setPrimary") === "on";
    const payload = {
      make: String(form.get("make") ?? ""),
      model: String(form.get("model") ?? ""),
      trim: String(form.get("trim") ?? ""),
      year: form.get("year") ? Number(form.get("year")) : null,
      bodyType: form.get("bodyType") || null,
      fuelType: String(form.get("fuelType") ?? "OTHER"),
      engine: String(form.get("engine") ?? ""),
      transmission: form.get("transmission") || null,
      plateInput: normalizePlateNumber(plateInput),
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
        setFieldErrors(data.fieldErrors ?? {});
        setLoading(false);
        return;
      }

      const id: string = data.vehicle?.id ?? vehicle?.id;

      if (photoFile) {
        const photoData = new FormData();
        photoData.append("photo", photoFile);
        await fetch(`/api/vehicles/${id}/photo`, { method: "POST", body: photoData });
      }

      if (!isEdit && setPrimary && !data.vehicle?.isPrimary) {
        await fetch(`/api/vehicles/${id}/set-primary`, { method: "POST" });
      }

      router.push(`/espace-client/vehicules/${id}`);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <FormSection title="Identification">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Marque" htmlFor="make" errors={fieldErrors.make}>
            <input id="make" name="make" required defaultValue={vehicle?.make} className="input" />
          </Field>
          <Field label="Modèle" htmlFor="model" errors={fieldErrors.model}>
            <input id="model" name="model" required defaultValue={vehicle?.model} className="input" />
          </Field>
          <Field label="Version" htmlFor="trim" errors={fieldErrors.trim}>
            <input id="trim" name="trim" defaultValue={vehicle?.trim ?? ""} className="input" />
          </Field>
          <Field label="Année" htmlFor="year" errors={fieldErrors.year}>
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
          <Field
            label="VIN / numéro de châssis"
            htmlFor="vin"
            errors={fieldErrors.vin}
            hint="Facultatif si vous ne le connaissez pas"
          >
            <input id="vin" name="vin" defaultValue={vehicle?.vin ?? ""} className="input" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Immatriculation">
        <Field
          label="Immatriculation"
          htmlFor="plateInput"
          errors={fieldErrors.plateInput}
          hint="Format : LL CCC LL"
        >
          <input
            id="plateInput"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
            required
            placeholder="AB 123 CD"
            className="input sm:max-w-xs"
          />
          {plateInput && !plateValid && (
            <p className="mt-1 text-xs text-chicano-red">
              Le numéro d&apos;immatriculation doit respecter le format malien LL CCC LL.
            </p>
          )}
          {plateInput && plateValid && platePreview && (
            <p className="mt-1 text-xs text-chicano-gray">Aperçu : {platePreview}</p>
          )}
        </Field>
      </FormSection>

      <FormSection title="Caractéristiques">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type de véhicule" htmlFor="bodyType" errors={fieldErrors.bodyType}>
            <select id="bodyType" name="bodyType" defaultValue={vehicle?.bodyType ?? ""} className="input">
              <option value="">Non précisé</option>
              {BODY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Carburant" htmlFor="fuelType" errors={fieldErrors.fuelType}>
            <select id="fuelType" name="fuelType" defaultValue={vehicle?.fuelType ?? "OTHER"} className="input">
              {FUEL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motorisation" htmlFor="engine" errors={fieldErrors.engine}>
            <input
              id="engine"
              name="engine"
              placeholder="ex. 2.4L Turbo Diesel"
              defaultValue={vehicle?.engine ?? ""}
              className="input"
            />
          </Field>
          <Field label="Boîte de vitesses" htmlFor="transmission" errors={fieldErrors.transmission}>
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
          <Field label="Couleur" htmlFor="color" errors={fieldErrors.color}>
            <input id="color" name="color" defaultValue={vehicle?.color ?? ""} className="input" />
          </Field>
          <Field
            label="Date de première mise en circulation"
            htmlFor="firstRegisteredAt"
            errors={fieldErrors.firstRegisteredAt}
          >
            <input
              id="firstRegisteredAt"
              name="firstRegisteredAt"
              type="date"
              defaultValue={dateInputValue(vehicle?.firstRegisteredAt)}
              className="input"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Utilisation">
        <Field label="Kilométrage" htmlFor="mileage" errors={fieldErrors.mileage}>
          <input
            id="mileage"
            name="mileage"
            type="number"
            min={0}
            defaultValue={vehicle?.mileage ?? ""}
            className="input sm:max-w-xs"
          />
        </Field>
      </FormSection>

      <FormSection title="Photo">
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-chicano-gray file:mr-3 file:rounded-md file:border file:border-chicano-gray-light file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-chicano-black hover:file:border-chicano-red"
          />
          <p className="mt-1 text-xs text-chicano-gray">
            JPEG, PNG ou WebP, 8 Mo max.{" "}
            {isEdit && "Vous pouvez aussi gérer la photo directement depuis la fiche véhicule."}
          </p>
        </div>
      </FormSection>

      {!isEdit && (
        <FormSection title="Options">
          <label className="flex items-start gap-2 text-sm text-chicano-black">
            <input type="checkbox" name="setPrimary" className="mt-1" />
            Définir comme véhicule principal
          </label>
        </FormSection>
      )}

      <Field label="Informations complémentaires" htmlFor="notes" errors={fieldErrors.notes}>
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-4 text-sm font-semibold uppercase tracking-wide text-chicano-gray">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-chicano-black">
        {label}
      </label>
      {children}
      {hint && !errors?.length && <p className="mt-1 text-xs text-chicano-gray">{hint}</p>}
      {errors?.map((message) => (
        <p key={message} className="mt-1 text-xs text-chicano-red">
          {message}
        </p>
      ))}
    </div>
  );
}
