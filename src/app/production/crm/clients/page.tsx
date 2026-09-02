import Link from "next/link";
import { listCustomersForCrm } from "@/lib/crm/directory";
import type { CampaignSegment } from "@prisma/client";

const SEGMENTS: { value: CampaignSegment | undefined; label: string }[] = [
  { value: undefined, label: "Tout" },
  { value: "NEW", label: "Nouveaux" },
  { value: "ACTIVE", label: "Actifs" },
  { value: "RECURRING", label: "Récurrents" },
  { value: "VIP", label: "VIP" },
  { value: "DORMANT", label: "Dormants" },
  { value: "AT_RISK", label: "À risque" },
];

const VALID_SEGMENTS = new Set(["NEW", "ACTIVE", "RECURRING", "DORMANT", "AT_RISK", "VIP"]);

export default async function CrmClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; search?: string; page?: string }>;
}) {
  const { segment, search, page } = await searchParams;
  const validSegment = segment && VALID_SEGMENTS.has(segment) ? (segment as CampaignSegment) : undefined;
  const pageNum = Number(page ?? "1") || 1;

  const result = await listCustomersForCrm({ segment: validSegment, search, page: pageNum });

  return (
    <div>
      <h1 className="text-2xl font-bold">Clients — CRM</h1>
      <p className="mt-1 text-sm text-white/60">{result.total} client(s)</p>

      <form className="mt-4 flex gap-2" action="/production/crm/clients" method="get">
        {validSegment && <input type="hidden" name="segment" value={validSegment} />}
        <input
          type="text"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Nom ou téléphone..."
          className="w-64 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button type="submit" className="rounded-md bg-chicano-red px-4 py-2 text-sm font-semibold text-white hover:bg-chicano-red-dark">
          Rechercher
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <Link
            key={s.label}
            href={s.value ? `/production/crm/clients?segment=${s.value}` : "/production/crm/clients"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              validSegment === s.value ? "bg-chicano-red text-white" : "border border-white/20 text-white/70 hover:border-white/40"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {result.items.map((c) => (
          <Link
            key={c.id}
            href={`/production/crm/clients/${c.id}`}
            className="block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/30"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">
                {c.firstName} {c.lastName}
              </p>
              <div className="flex gap-1">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{c.segment}</span>
                {c.atRiskReasons.length > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">⚠ {c.atRiskReasons.length}</span>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-white/60">{c.phoneE164} · {c.customerType}</p>
          </Link>
        ))}
        {result.items.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">Aucun client pour ce filtre.</p>
        )}
      </div>

      {result.totalPages > 1 && (
        <div className="mt-4 flex gap-2">
          {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/production/crm/clients?${validSegment ? `segment=${validSegment}&` : ""}${search ? `search=${encodeURIComponent(search)}&` : ""}page=${p}`}
              className={`rounded-md px-3 py-1.5 text-xs ${p === result.page ? "bg-chicano-red text-white" : "border border-white/20 text-white/70"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
