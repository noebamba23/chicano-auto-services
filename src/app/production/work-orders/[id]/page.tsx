import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkOrderForProduction, WorkOrderNotFoundError } from "@/lib/work-orders/service";
import { listTechnicians } from "@/lib/technicians/service";
import {
  workOrderStatusLabel,
  workOrderPriorityLabel,
  workOrderItemTypeLabel,
  workOrderItemStatusLabel,
  workOrderPartStatusLabel,
} from "@/lib/work-orders/options";
import { formatXOF } from "@/lib/quotes/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";
import { WorkOrderActions } from "@/components/production/work-order-actions";

export default async function ProductionWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let workOrder;
  try {
    workOrder = await getWorkOrderForProduction(id);
  } catch (err) {
    if (err instanceof WorkOrderNotFoundError) notFound();
    throw err;
  }

  const technicians = await listTechnicians();

  return (
    <div>
      <Link href="/production/work-orders" className="text-sm text-white/60 hover:text-white">
        ← Work Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{workOrder.workOrderNumber}</h1>
          <p className="mt-1 text-sm text-white/60">
            {workOrder.customer?.user.firstName} {workOrder.customer?.user.lastName} — {workOrder.customer?.user.phoneE164}
          </p>
        </div>
        <div className="flex gap-2">
          {workOrder.priority === "URGENT" && (
            <span className="rounded-full bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300">
              {workOrderPriorityLabel(workOrder.priority)}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
            {workOrderStatusLabel(workOrder.status)}
          </span>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Véhicule" value={`${workOrder.vehicle.make} ${workOrder.vehicle.model} (${workOrder.vehicle.chicanoVehicleId})`} />
          {workOrder.vehicle.licensePlate && (
            <Field label="Immatriculation" value={formatPlateNumber(workOrder.vehicle.licensePlate) ?? ""} />
          )}
          <Field label="Demande" value={workOrder.serviceRequest?.referenceNumber ?? "—"} />
          <Field label="Devis accepté" value={`${workOrder.quote.quoteNumber} (v${workOrder.acceptedQuoteVersionNumber})`} />
          <Field label="Montant" value={formatXOF(workOrder.quote.totalAmount)} />
          {workOrder.diagnosticReport && <Field label="Rapport" value={workOrder.diagnosticReport.reportNumber} />}
          <Field
            label="Rendez-vous"
            value={
              workOrder.appointment?.scheduledDate
                ? `${new Date(workOrder.appointment.scheduledDate).toLocaleDateString("fr-FR")} — ${workOrder.appointment.scheduledSlot ?? ""}`
                : "À planifier"
            }
          />
          <Field
            label="Technicien"
            value={workOrder.technician ? `${workOrder.technician.user.firstName} ${workOrder.technician.user.lastName}` : "Non affecté"}
          />
        </dl>

        {workOrder.additionalWorkRequested && (
          <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-300">⚠️ Travaux supplémentaires signalés</p>
            {workOrder.additionalWorkNotes && <p className="mt-1 text-sm text-white/70">{workOrder.additionalWorkNotes}</p>}
          </div>
        )}

        {workOrder.requiresTowing && (
          <div className="mt-4 rounded-md border border-white/20 bg-white/5 p-3">
            <p className="text-sm font-semibold">🚛 Embarquement garage requis</p>
            {workOrder.transfer && (
              <p className="mt-1 text-sm text-white/70">
                {workOrder.transfer.reason}
                {workOrder.transfer.receivedAt ? " · Reçu au garage" : " · En attente de réception"}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Travaux</h2>
        <div className="mt-3 space-y-2">
          {workOrder.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
              <div>
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-white/50">
                  {workOrderItemTypeLabel(item.type)} · {item.quantity ? Number(item.quantity) : 1} × {formatXOF(item.unitPrice)}
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{workOrderItemStatusLabel(item.status)}</span>
            </div>
          ))}
          {workOrder.items.length === 0 && <p className="text-sm text-white/50">Aucune ligne de travaux.</p>}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Pièces</h2>
        <div className="mt-3 space-y-2">
          {workOrder.parts.map((part) => (
            <div key={part.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm">{part.label}{part.reference ? ` (${part.reference})` : ""} — {part.quantity}</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{workOrderPartStatusLabel(part.status)}</span>
            </div>
          ))}
          {workOrder.parts.length === 0 && <p className="text-sm text-white/50">Aucune pièce demandée.</p>}
        </div>
      </section>

      {workOrder.qualityCheckedAt && (
        <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Contrôle qualité</h2>
          <p className="mt-2 text-sm">{workOrder.qualityCheckPassed ? "✅ Validé" : "❌ Non concluant"}</p>
          {workOrder.qualityCheckNotes && <p className="mt-1 text-sm text-white/70">{workOrder.qualityCheckNotes}</p>}
        </section>
      )}

      <div className="mt-6">
        <WorkOrderActions
          workOrderId={workOrder.id}
          status={workOrder.status}
          technicians={technicians.map((t) => ({ id: t.id, user: t.user }))}
          currentTechnicianId={workOrder.technicianId}
        />
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
