import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTechnicianIdForUser } from "@/lib/technicians/service";
import { getWorkOrderForTechnician, WorkOrderNotFoundError } from "@/lib/work-orders/service";
import { workOrderStatusLabel, workOrderItemTypeLabel, workOrderPartStatusLabel } from "@/lib/work-orders/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import { TechnicienWorkOrderActions } from "@/components/technicien/work-order-actions";

export default async function TechnicienWorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const technicianId = session ? await getTechnicianIdForUser(session.sub) : null;
  if (!technicianId) notFound();

  let workOrder;
  try {
    workOrder = await getWorkOrderForTechnician(technicianId, id);
  } catch (err) {
    if (err instanceof WorkOrderNotFoundError) notFound();
    throw err;
  }

  return (
    <div>
      <Link href="/technicien/reparations" className="text-sm text-white/60 hover:text-white">
        ← Mes réparations
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{workOrder.workOrderNumber}</h1>
          <p className="mt-1 text-sm text-white/60">
            {workOrder.customer?.user.firstName} {workOrder.customer?.user.lastName}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
          {workOrderStatusLabel(workOrder.status)}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Véhicule" value={`${workOrder.vehicle.make} ${workOrder.vehicle.model} (${workOrder.vehicle.chicanoVehicleId})`} />
          {workOrder.vehicle.licensePlate && (
            <Field label="Immatriculation" value={formatPlateNumber(workOrder.vehicle.licensePlate) ?? ""} />
          )}
          <Field
            label="Rendez-vous"
            value={
              workOrder.appointment?.scheduledDate
                ? `${new Date(workOrder.appointment.scheduledDate).toLocaleDateString("fr-FR")} — ${workOrder.appointment.scheduledSlot ?? ""}`
                : "À définir"
            }
          />
        </dl>
      </section>

      {workOrder.diagnosticReport && (
        <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Rapport de diagnostic</h2>
          <p className="mt-2 text-sm">{workOrder.diagnosticReport.conclusion}</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Travaux</h2>
        <div className="mt-3 space-y-2">
          {workOrder.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              {item.description} <span className="text-white/50">({workOrderItemTypeLabel(item.type)})</span>
            </div>
          ))}
          {workOrder.items.length === 0 && <p className="text-sm text-white/50">Aucune ligne de travaux.</p>}
        </div>
      </section>

      {workOrder.parts.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Pièces</h2>
          <div className="mt-3 space-y-2">
            {workOrder.parts.map((part) => (
              <div key={part.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                <span>{part.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{workOrderPartStatusLabel(part.status)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6">
        <TechnicienWorkOrderActions workOrderId={workOrder.id} status={workOrder.status} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-white/50">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
