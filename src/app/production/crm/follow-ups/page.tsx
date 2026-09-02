import Link from "next/link";
import { listFollowUpsForProduction } from "@/lib/crm/follow-ups";
import { db } from "@/lib/db";
import { FollowUpStatusButtons } from "@/components/production/crm-actions";
import type { FollowUpStatus } from "@prisma/client";

const FILTERS: { value: FollowUpStatus | undefined; label: string }[] = [
  { value: undefined, label: "Tout" },
  { value: "PENDING", label: "En attente" },
  { value: "DONE", label: "Faites" },
  { value: "CANCELLED", label: "Annulées" },
];

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const validStatus = (["PENDING", "DONE", "CANCELLED"] as const).includes(status as never) ? (status as FollowUpStatus) : undefined;

  const followUps = await listFollowUpsForProduction({ status: validStatus });
  const customerIds = [...new Set(followUps.map((f) => f.customerId as string))];
  const customers = customerIds.length
    ? await db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } })
    : [];
  const nameById = new Map(customers.map((c) => [c.id, `${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim()]));

  return (
    <div>
      <h1 className="text-2xl font-bold">Relances</h1>
      <p className="mt-1 text-sm text-white/60">{followUps.length} relance(s)</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/production/crm/follow-ups?status=${f.value}` : "/production/crm/follow-ups"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              validStatus === f.value ? "bg-chicano-red text-white" : "border border-white/20 text-white/70 hover:border-white/40"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {followUps.map((f) => (
          <div key={f.id as string} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <Link href={`/production/crm/clients/${f.customerId}`} className="font-semibold hover:underline">
                {nameById.get(f.customerId as string) || "Client"}
              </Link>
              <p className="text-sm text-white/60">{f.reason as string}</p>
              <p className="text-xs text-white/40">échéance {new Date(f.dueAt).toLocaleString("fr-FR")}</p>
            </div>
            <FollowUpStatusButtons id={f.id as string} status={f.status as string} />
          </div>
        ))}
        {followUps.length === 0 && <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">Aucune relance pour ce filtre.</p>}
      </div>
    </div>
  );
}
