import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { getServiceRequestForCustomer, ServiceRequestNotFoundError } from "@/lib/service-requests/service";
import {
  interventionTypeLabel,
  serviceCategoryLabel,
  serviceRequestStatusLabel,
  slotLabel,
  urgencyReasonLabel,
} from "@/lib/service-requests/options";
import { CancelRequestButton } from "@/components/service-requests/cancel-request-button";

const CANCELLABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "RESCHEDULE_REQUESTED", "ACCEPTED"];

export default async function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/demandes/${id}`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let request;
  try {
    request = await getServiceRequestForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof ServiceRequestNotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/espace-client/demandes" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes demandes
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">{request.referenceNumber}</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {request.vehicle.make} {request.vehicle.model} ({request.vehicle.chicanoVehicleId})
          </p>
        </div>
        <span className="rounded-full bg-chicano-black px-3 py-1.5 text-sm font-semibold text-white">
          {serviceRequestStatusLabel(request.status)}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Service" value={serviceCategoryLabel(request.category)} />
          <Field
            label="Mode d'intervention"
            value={interventionTypeLabel(request.interventionType)}
          />
          <Field label="Urgence" value={request.isUrgent ? "🔴 Urgent" : "Non"} />
          {request.urgencyReason && <Field label="Motif urgence" value={urgencyReasonLabel(request.urgencyReason) ?? ""} />}
          {request.preferredDate && (
            <Field
              label="Date souhaitée"
              value={`${new Date(request.preferredDate).toLocaleDateString("fr-FR")} — ${slotLabel(request.preferredSlot) ?? ""}`}
            />
          )}
        </dl>
        <div className="mt-4">
          <p className="text-xs text-chicano-gray">Description</p>
          <p className="mt-1 text-sm text-chicano-black">{request.description}</p>
        </div>
        {request.isUrgent && request.urgencyDescription && (
          <div className="mt-4">
            <p className="text-xs text-chicano-gray">Situation d&apos;urgence</p>
            <p className="mt-1 text-sm text-chicano-black">{request.urgencyDescription}</p>
          </div>
        )}
        {request.location && (
          <div className="mt-4">
            <p className="text-xs text-chicano-gray">Localisation</p>
            <p className="mt-1 text-sm text-chicano-black">
              {[request.location.neighborhood, request.location.commune, request.location.city, request.location.landmark]
                .filter(Boolean)
                .join(", ") || "Position GPS transmise"}
            </p>
          </div>
        )}
        {request.attachments.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-chicano-gray">Pièces jointes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {request.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-chicano-gray-light px-3 py-1.5 text-xs text-chicano-black hover:border-chicano-red"
                >
                  {a.type === "video" ? "🎥" : "📷"} Voir
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {request.appointment && (
        <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Rendez-vous</h2>
          <p className="mt-2 text-sm text-chicano-black">
            {request.appointment.scheduledDate
              ? new Date(request.appointment.scheduledDate).toLocaleDateString("fr-FR")
              : "Date à confirmer"}{" "}
            — {slotLabel(request.appointment.scheduledSlot) ?? "Créneau à confirmer"}
          </p>
        </section>
      )}

      {CANCELLABLE_STATUSES.includes(request.status) && (
        <div className="mt-6">
          <CancelRequestButton requestId={request.id} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-chicano-gray">{label}</dt>
      <dd className="text-sm font-medium text-chicano-black">{value}</dd>
    </div>
  );
}
