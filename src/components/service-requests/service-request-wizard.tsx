"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Vehicle } from "@prisma/client";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import {
  SERVICE_CATEGORY_OPTIONS,
  INTERVENTION_TYPE_OPTIONS,
  SERVICE_SLOTS,
  serviceCategoryLabel,
  interventionTypeLabel,
  slotLabel,
} from "@/lib/service-requests/options";

type LocationState = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address: string;
  city: string;
  district: string;
  commune: string;
  neighborhood: string;
  landmark: string;
  locationSource: "GPS" | "MANUAL";
};

const EMPTY_LOCATION: LocationState = {
  address: "",
  city: "",
  district: "",
  commune: "",
  neighborhood: "",
  landmark: "",
  locationSource: "MANUAL",
};

const TOTAL_STEPS = 8;

export function ServiceRequestWizard({
  vehicle,
  initialCategory,
}: {
  vehicle: Vehicle;
  initialCategory?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string | null>(
    SERVICE_CATEGORY_OPTIONS.some((o) => o.value === initialCategory) ? (initialCategory as string) : null
  );
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [interventionType, setInterventionType] = useState<"AT_GARAGE" | "MOBILE" | null>(null);
  const [isUrgent, setIsUrgent] = useState<boolean | null>(null);
  const [urgencyDescription, setUrgencyDescription] = useState("");
  const [location, setLocation] = useState<LocationState>(EMPTY_LOCATION);
  const [locatingGps, setLocatingGps] = useState(false);
  const [asap, setAsap] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredSlot, setPreferredSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  function next() {
    let target = step + 1;
    // Étape 6 (localisation) uniquement si intervention mobile.
    if (target === 6 && interventionType !== "MOBILE") target = 7;
    setStep(Math.min(target, TOTAL_STEPS));
  }

  function back() {
    let target = step - 1;
    if (target === 6 && interventionType !== "MOBILE") target = 5;
    setStep(Math.max(target, 1));
  }

  function useMyPosition() {
    if (!("geolocation" in navigator)) {
      setError("La géolocalisation n'est pas disponible sur cet appareil. Saisissez votre adresse manuellement.");
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation((l) => ({
          ...l,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          locationSource: "GPS",
        }));
        setLocatingGps(false);
      },
      () => {
        setError("Position refusée ou indisponible — vous pouvez saisir votre adresse manuellement ci-dessous.");
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const payload = {
      vehicleId: vehicle.id,
      category,
      description,
      interventionType,
      isUrgent: isUrgent ?? false,
      urgencyDescription,
      preferredDate: asap ? "" : preferredDate,
      preferredSlot: asap ? null : preferredSlot,
      location:
        interventionType === "MOBILE"
          ? {
              latitude: location.latitude ?? null,
              longitude: location.longitude ?? null,
              accuracy: location.accuracy ?? null,
              address: location.address,
              city: location.city,
              district: location.district,
              commune: location.commune,
              neighborhood: location.neighborhood,
              landmark: location.landmark,
              locationSource: location.locationSource,
            }
          : null,
    };

    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        setSubmitting(false);
        return;
      }

      const requestId = data.request.id as string;

      for (const file of mediaFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/service-requests/${requestId}/attachments`, { method: "POST", body: fd });
      }

      setReference(data.request.referenceNumber);
    } catch {
      setError("Impossible de contacter le serveur.");
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-3xl">✅</p>
        <h1 className="mt-4 text-xl font-bold text-chicano-black">Demande envoyée</h1>
        <p className="mt-2 text-lg font-semibold text-chicano-red">{reference}</p>
        <p className="mt-4 text-sm text-chicano-gray">
          Votre demande a bien été reçue. Notre équipe CHICANO va l&apos;étudier et vous confirmer la prise en
          charge.
        </p>
        <button
          onClick={() => router.push("/espace-client/demandes")}
          className="mt-6 w-full rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark"
        >
          Voir mes demandes
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-1">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-chicano-red" : "bg-chicano-gray-light"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <StepShell title="Votre véhicule">
          <div className="rounded-lg border border-chicano-gray-light bg-white p-4">
            <p className="font-semibold text-chicano-black">
              {vehicle.make} {vehicle.model}
            </p>
            {vehicle.licensePlate && (
              <p className="text-sm font-medium text-chicano-black">{formatPlateNumber(vehicle.licensePlate)}</p>
            )}
            <p className="text-sm text-chicano-gray">{vehicle.chicanoVehicleId}</p>
          </div>
          <Link
            href="/espace-client/vehicules"
            className="mt-3 inline-block text-sm font-medium text-chicano-red"
          >
            Changer de véhicule
          </Link>
          <NavButtons onNext={next} nextDisabled={false} showBack={false} />
        </StepShell>
      )}

      {step === 2 && (
        <StepShell title="Quel service ?">
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_CATEGORY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setCategory(o.value)}
                className={`rounded-lg border p-4 text-center transition ${
                  category === o.value
                    ? "border-chicano-red bg-chicano-red/5"
                    : "border-chicano-gray-light hover:border-chicano-red"
                }`}
              >
                <span className="text-2xl">{o.emoji}</span>
                <p className="mt-2 text-sm font-medium text-chicano-black">{o.label}</p>
              </button>
            ))}
          </div>
          <NavButtons onBack={back} onNext={next} nextDisabled={!category} />
        </StepShell>
      )}

      {step === 3 && (
        <StepShell title="Que se passe-t-il avec votre véhicule ?">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="ex. Le véhicule ne démarre plus."
            className="input"
          />
          <div className="mt-4">
            <label className="block text-sm font-medium text-chicano-black">
              Photo ou vidéo <span className="font-normal text-chicano-gray">(facultatif)</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              multiple
              onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
              className="mt-1 block w-full text-sm text-chicano-gray file:mr-3 file:rounded-md file:border file:border-chicano-gray-light file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-chicano-black hover:file:border-chicano-red"
            />
          </div>
          <NavButtons onBack={back} onNext={next} nextDisabled={description.trim().length === 0} />
        </StepShell>
      )}

      {step === 4 && (
        <StepShell title="Où souhaitez-vous l'intervention ?">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INTERVENTION_TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setInterventionType(o.value)}
                className={`rounded-lg border p-5 text-center transition ${
                  interventionType === o.value
                    ? "border-chicano-red bg-chicano-red/5"
                    : "border-chicano-gray-light hover:border-chicano-red"
                }`}
              >
                <span className="text-2xl">{o.emoji}</span>
                <p className="mt-2 text-sm font-medium text-chicano-black">{o.label}</p>
              </button>
            ))}
          </div>
          <NavButtons onBack={back} onNext={next} nextDisabled={!interventionType} />
        </StepShell>
      )}

      {step === 5 && (
        <StepShell title="Est-ce une urgence ?">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsUrgent(false)}
              className={`rounded-lg border p-4 text-center font-medium transition ${
                isUrgent === false
                  ? "border-chicano-red bg-chicano-red/5 text-chicano-black"
                  : "border-chicano-gray-light text-chicano-black hover:border-chicano-red"
              }`}
            >
              Non
            </button>
            <button
              onClick={() => setIsUrgent(true)}
              className={`rounded-lg border p-4 text-center font-medium transition ${
                isUrgent === true
                  ? "border-chicano-red bg-chicano-red/5 text-chicano-red"
                  : "border-chicano-gray-light text-chicano-black hover:border-chicano-red"
              }`}
            >
              🔴 Oui — Urgent
            </button>
          </div>
          {isUrgent && (
            <textarea
              value={urgencyDescription}
              onChange={(e) => setUrgencyDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez brièvement la situation."
              className="input mt-4"
            />
          )}
          <NavButtons
            onBack={back}
            onNext={next}
            nextDisabled={isUrgent === null || (isUrgent && urgencyDescription.trim().length === 0)}
          />
        </StepShell>
      )}

      {step === 6 && interventionType === "MOBILE" && (
        <StepShell title="Où êtes-vous ?">
          <button
            onClick={useMyPosition}
            disabled={locatingGps}
            className="w-full rounded-md bg-chicano-black px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-black-soft disabled:opacity-60"
          >
            {locatingGps ? "Localisation..." : "📍 Utiliser ma position"}
          </button>

          {location.latitude != null && location.longitude != null && (
            <p className="mt-2 text-xs text-chicano-gray">
              Position capturée ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)})
              {location.accuracy ? ` — précision ${Math.round(location.accuracy)} m` : ""}
            </p>
          )}

          <p className="mt-4 mb-2 text-sm font-medium text-chicano-black">
            Ou décrivez votre adresse <span className="font-normal text-chicano-gray">(quartier, point de repère...)</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              placeholder="Quartier"
              value={location.neighborhood}
              onChange={(e) => setLocation((l) => ({ ...l, neighborhood: e.target.value }))}
              className="input"
            />
            <input
              placeholder="Commune"
              value={location.commune}
              onChange={(e) => setLocation((l) => ({ ...l, commune: e.target.value }))}
              className="input"
            />
            <input
              placeholder="Ville"
              value={location.city}
              onChange={(e) => setLocation((l) => ({ ...l, city: e.target.value }))}
              className="input"
            />
            <input
              placeholder="Point de repère (ex. près de...)"
              value={location.landmark}
              onChange={(e) => setLocation((l) => ({ ...l, landmark: e.target.value }))}
              className="input"
            />
          </div>
          <textarea
            placeholder="Adresse libre / précisions"
            value={location.address}
            onChange={(e) => setLocation((l) => ({ ...l, address: e.target.value }))}
            rows={2}
            className="input mt-3"
          />

          <NavButtons
            onBack={back}
            onNext={next}
            nextDisabled={
              location.latitude == null &&
              !location.address &&
              !location.neighborhood &&
              !location.landmark &&
              !location.commune
            }
          />
        </StepShell>
      )}

      {step === 7 && (
        <StepShell title="Quand souhaitez-vous être pris en charge ?">
          <label className="flex items-center gap-2 text-sm text-chicano-black">
            <input type="checkbox" checked={asap} onChange={(e) => setAsap(e.target.checked)} />
            Dès que possible
          </label>

          {!asap && (
            <>
              <input
                type="date"
                value={preferredDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="input mt-4"
              />
              <p className="mt-4 mb-2 text-sm font-medium text-chicano-black">Créneau souhaité</p>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_SLOTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setPreferredSlot(s.value)}
                    className={`rounded-md border p-2 text-sm transition ${
                      preferredSlot === s.value
                        ? "border-chicano-red bg-chicano-red/5 text-chicano-black"
                        : "border-chicano-gray-light text-chicano-black hover:border-chicano-red"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="mt-4 text-xs text-chicano-gray">
            La date/le créneau choisi est une demande — la confirmation reste soumise à CHICANO.
          </p>
          <NavButtons onBack={back} onNext={next} nextDisabled={!asap && (!preferredDate || !preferredSlot)} />
        </StepShell>
      )}

      {step === 8 && (
        <StepShell title="Vérifiez votre demande">
          <dl className="space-y-3 rounded-lg border border-chicano-gray-light bg-white p-4 text-sm">
            <Row label="Véhicule" value={`${vehicle.make} ${vehicle.model}`} onEdit={() => setStep(1)} />
            <Row label="Service" value={category ? serviceCategoryLabel(category as never) : ""} onEdit={() => setStep(2)} />
            <Row label="Problème" value={description} onEdit={() => setStep(3)} />
            <Row
              label="Mode d'intervention"
              value={interventionType ? interventionTypeLabel(interventionType) : ""}
              onEdit={() => setStep(4)}
            />
            <Row label="Urgence" value={isUrgent ? "🔴 Urgent" : "Non"} onEdit={() => setStep(5)} />
            {interventionType === "MOBILE" && (
              <Row
                label="Localisation"
                value={location.neighborhood || location.address || location.landmark || "Position GPS capturée"}
                onEdit={() => setStep(6)}
              />
            )}
            <Row
              label="Date / créneau"
              value={asap ? "Dès que possible" : `${preferredDate} — ${slotLabel(preferredSlot) ?? ""}`}
              onEdit={() => setStep(7)}
            />
          </dl>

          {error && <p className="mt-3 text-sm text-chicano-red">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button
              onClick={back}
              className="flex-1 rounded-md border border-chicano-gray-light px-4 py-3 text-sm font-semibold text-chicano-black"
            >
              Modifier
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
            >
              {submitting ? "Envoi..." : "Envoyer ma demande"}
            </button>
          </div>
        </StepShell>
      )}
    </div>
  );
}

function StepShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-chicano-black">{title}</h1>
      {children}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      {showBack && onBack && (
        <button
          onClick={onBack}
          className="rounded-md border border-chicano-gray-light px-4 py-3 text-sm font-semibold text-chicano-black"
        >
          Précédent
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 rounded-md bg-chicano-red px-4 py-3 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-40"
      >
        Suivant
      </button>
    </div>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-chicano-gray-light pb-2 last:border-0 last:pb-0">
      <div>
        <dt className="text-xs text-chicano-gray">{label}</dt>
        <dd className="font-medium text-chicano-black">{value}</dd>
      </div>
      <button onClick={onEdit} className="shrink-0 text-xs font-medium text-chicano-red">
        Modifier
      </button>
    </div>
  );
}
