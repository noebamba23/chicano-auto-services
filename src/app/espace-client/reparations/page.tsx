import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { listWorkOrdersForCustomer } from "@/lib/work-orders/service";
import { workOrderStatusLabel } from "@/lib/work-orders/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";

export default async function ClientWorkOrdersPage() {
  const session = await getSession();
  const customerId = session ? await getCustomerIdForUser(session.sub) : null;
  const workOrders = customerId ? await listWorkOrdersForCustomer(customerId) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-chicano-black">Mes réparations</h1>
      <p className="mt-1 text-sm text-chicano-gray">{workOrders.length} réparation(s)</p>

      <div className="mt-6 space-y-3">
        {workOrders.map((wo) => (
          <Link
            key={wo.id}
            href={`/espace-client/reparations/${wo.id}`}
            className="block rounded-lg border border-chicano-gray-light bg-white p-4 hover:border-chicano-red"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-chicano-black">{wo.workOrderNumber}</p>
              <span className="rounded-full bg-chicano-gray-light px-2 py-0.5 text-xs text-chicano-black">
                {workOrderStatusLabel(wo.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-chicano-gray">
              {wo.vehicle.make} {wo.vehicle.model}
              {wo.vehicle.licensePlate ? ` — ${formatPlateNumber(wo.vehicle.licensePlate)}` : ""}
            </p>
          </Link>
        ))}
        {workOrders.length === 0 && (
          <p className="rounded-lg border border-chicano-gray-light bg-white p-6 text-center text-sm text-chicano-gray">
            Aucune réparation pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
