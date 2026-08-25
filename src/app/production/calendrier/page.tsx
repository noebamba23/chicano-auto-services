import Link from "next/link";
import { listAppointmentsInRange } from "@/lib/appointments/service";
import { SERVICE_SLOTS, serviceCategoryLabel } from "@/lib/service-requests/options";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ProductionCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const anchor = week ? new Date(week) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const appointments = await listAppointmentsInRange(weekStart, weekEnd);

  const byDaySlot = new Map<string, typeof appointments>();
  for (const a of appointments) {
    if (!a.scheduledDate || !a.scheduledSlot) continue;
    const key = `${toDateKey(new Date(a.scheduledDate))}|${a.scheduledSlot}`;
    byDaySlot.set(key, [...(byDaySlot.get(key) ?? []), a]);
  }

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <div className="flex gap-2">
          <Link
            href={`/production/calendrier?week=${toDateKey(prevWeek)}`}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            ← Semaine précédente
          </Link>
          <Link
            href={`/production/calendrier?week=${toDateKey(nextWeek)}`}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Semaine suivante →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-white/60">
        {weekStart.toLocaleDateString("fr-FR")} — {days[6].toLocaleDateString("fr-FR")}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28 border border-white/10 bg-white/5 p-2 text-left text-xs text-white/50">
                Créneau
              </th>
              {days.map((d, i) => (
                <th key={i} className="border border-white/10 bg-white/5 p-2 text-left text-xs text-white/50">
                  {DAY_LABELS[i]} {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SERVICE_SLOTS.map((slot) => (
              <tr key={slot.value}>
                <td className="border border-white/10 p-2 align-top text-xs font-medium text-white/70">
                  {slot.label}
                </td>
                {days.map((d, i) => {
                  const key = `${toDateKey(d)}|${slot.value}`;
                  const items = byDaySlot.get(key) ?? [];
                  return (
                    <td key={i} className="border border-white/10 p-1 align-top">
                      <div className="space-y-1">
                        {items.map((a) => (
                          <Link
                            key={a.id}
                            href={`/production/demandes/${a.serviceRequestId}`}
                            className="block rounded-md border border-white/10 bg-chicano-black p-1.5 text-xs hover:border-chicano-red"
                          >
                            <p className="font-semibold text-chicano-red">{a.serviceRequest.referenceNumber}</p>
                            <p className="text-white/70">
                              {a.customer.user.firstName} {a.customer.user.lastName}
                            </p>
                            <p className="text-white/50">{serviceCategoryLabel(a.serviceRequest.category)}</p>
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
