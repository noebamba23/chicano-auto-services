import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { getWorkOrderForCustomer, WorkOrderNotFoundError } from "@/lib/work-orders/service";
import { workOrderStatusLabel, workOrderItemTypeLabel } from "@/lib/work-orders/options";
import { formatXOF } from "@/lib/quotes/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";

export default async function ClientWorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/reparations/${id}`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let workOrder;
  try {
    workOrder = await getWorkOrderForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof WorkOrderNotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/espace-client/reparations" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes réparations
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">{workOrder.workOrderNumber}</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {workOrder.vehicle.make} {workOrder.vehicle.model} ({workOrder.vehicle.chicanoVehicleId})
          </p>
          {workOrder.vehicle.licensePlate && (
            <p className="mt-1 text-sm font-medium text-chicano-black">{formatPlateNumber(workOrder.vehicle.licensePlate)}</p>
          )}
        </div>
        <span className="rounded-full bg-chicano-black px-3 py-1.5 text-sm font-semibold text-white">
          {workOrderStatusLabel(workOrder.status)}
        </span>
      </div>

      {workOrder.appointment?.scheduledDate && (
        <p className="mt-4 text-sm text-chicano-gray">
          Rendez-vous : {new Date(workOrder.appointment.scheduledDate).toLocaleDateString("fr-FR")}
          {workOrder.appointment.scheduledSlot ? ` — ${workOrder.appointment.scheduledSlot}` : ""}
        </p>
      )}

      {workOrder.technician && (
        <p className="mt-1 text-sm text-chicano-gray">
          Technicien : {workOrder.technician.user.firstName} {workOrder.technician.user.lastName}
        </p>
      )}

      <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Travaux</h2>
        <ul className="mt-3 divide-y divide-chicano-gray-light">
          {workOrder.items.map((item) => (
            <li key={item.id} className="py-2 text-sm text-chicano-black">
              <span className="font-medium">{item.description}</span>
              <span className="ml-2 text-chicano-gray">({workOrderItemTypeLabel(item.type)})</span>
            </li>
          ))}
          {workOrder.items.length === 0 && <li className="py-2 text-sm text-chicano-gray">Aucun détail disponible.</li>}
        </ul>
        <p className="mt-3 text-right text-lg font-bold text-chicano-black">Total : {formatXOF(workOrder.quote.totalAmount)}</p>
      </section>

      {workOrder.status === "COMPLETED" && (
        <div className="mt-6 rounded-lg border border-green-600/30 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-green-800">✅ Votre véhicule est prêt</p>
        </div>
      )}
    </div>
  );
}
