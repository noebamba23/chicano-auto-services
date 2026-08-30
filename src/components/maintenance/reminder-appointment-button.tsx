"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReminderAppointmentButton({ reminderId }: { reminderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestAppointment() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/maintenance-reminders/${reminderId}/request-appointment`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    router.push(`/espace-client/demandes/${data.serviceRequest.id}`);
  }

  return (
    <div>
      <button
        onClick={requestAppointment}
        disabled={loading}
        className="rounded-md bg-chicano-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-chicano-red-dark disabled:opacity-60"
      >
        {loading ? "..." : "Prendre rendez-vous"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
