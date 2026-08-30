import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getTechnicianIdForUser } from "@/lib/technicians/service";
import { listWorkOrdersForTechnician } from "@/lib/work-orders/service";
import { workOrderStatusLabel } from "@/lib/work-orders/options";

export default async function TechnicienWorkOrdersPage() {
  const session = await getSession();
  const technicianId = session ? await getTechnicianIdForUser(session.sub) : null;
  const workOrders = technicianId ? await listWorkOrdersForTechnician(technicianId) : [];

  return (
    <div>
      <Link href="/technicien" className="text-sm text-white/60 hover:text-white">
        ← Mes interventions
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Mes réparations</h1>
      <p className="mt-1 text-sm text-white/60">{workOrders.length} réparation(s) affectée(s)</p>

      <div className="mt-6 space-y-3">
        {workOrders.map((wo) => (
          <Link
            key={wo.id}
            href={`/technicien/reparations/${wo.id}`}
            className="block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{wo.workOrderNumber}</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{workOrderStatusLabel(wo.status)}</span>
            </div>
            <p className="mt-1 text-sm text-white/70">
              {wo.customer?.user.firstName} {wo.customer?.user.lastName} — {wo.vehicle.make} {wo.vehicle.model}
              {wo.priority === "URGENT" ? " · 🔴 Urgent" : ""}
            </p>
          </Link>
        ))}
        {workOrders.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            Aucune réparation affectée pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
