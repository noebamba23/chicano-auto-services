import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCustomerIdForUser } from "@/lib/vehicles/service";
import { getPublishedReportForCustomer, ReportNotFoundError } from "@/lib/reports/service";
import { severityLabel } from "@/lib/reports/options";
import { checkCategoryLabel, checkResultLabel } from "@/lib/diagnostics/options";
import { formatPlateNumber } from "@/lib/vehicles/registration/plate";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/connexion?next=/espace-client/rapports/${id}`);

  const customerId = await getCustomerIdForUser(session.sub);
  if (!customerId) redirect("/espace-client");

  let report;
  try {
    report = await getPublishedReportForCustomer(customerId, id);
  } catch (err) {
    if (err instanceof ReportNotFoundError) notFound();
    throw err;
  }

  const checkedCategories = report.diagnostic.checks.filter((c) => c.result !== "NOT_CHECKED");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/espace-client/rapports" className="text-sm text-chicano-gray hover:text-chicano-red">
        ← Mes rapports
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chicano-black">{report.reportNumber}</h1>
          <p className="mt-1 text-sm text-chicano-gray">
            {report.diagnostic.vehicle.make} {report.diagnostic.vehicle.model}
            {report.diagnostic.vehicle.year ? ` (${report.diagnostic.vehicle.year})` : ""}
          </p>
          {report.diagnostic.vehicle.licensePlate && (
            <p className="mt-1 text-sm font-medium text-chicano-black">
              {formatPlateNumber(report.diagnostic.vehicle.licensePlate)}
            </p>
          )}
          {report.diagnostic.vehicle.vin && (
            <p className="text-xs text-chicano-gray">VIN : {report.diagnostic.vehicle.vin}</p>
          )}
        </div>
        <span className="rounded-full bg-chicano-black px-3 py-1.5 text-sm font-semibold text-white">
          {severityLabel(report.severity)}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {report.diagnostic.mileageAtVisit !== null && (
            <div>
              <dt className="text-xs text-chicano-gray">Kilométrage</dt>
              <dd className="text-sm font-medium text-chicano-black">
                {report.diagnostic.mileageAtVisit.toLocaleString("fr-FR")} km
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-chicano-gray">Date</dt>
            <dd className="text-sm font-medium text-chicano-black">
              {new Date(report.publishedAt ?? report.createdAt).toLocaleDateString("fr-FR")}
            </dd>
          </div>
        </dl>
      </section>

      {report.conclusion && (
        <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Conclusion</h2>
          <p className="mt-2 text-sm text-chicano-black">{report.conclusion}</p>
        </section>
      )}

      {report.photos.length > 0 && (
        <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Photos</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt={p.caption ?? ""} className="h-24 w-24 rounded object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-chicano-gray-light bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chicano-gray">Points de contrôle</h2>
        {checkedCategories.length === 0 ? (
          <p className="mt-2 text-sm text-chicano-gray">Aucun point de contrôle renseigné.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {checkedCategories.map((c) => (
              <span key={c.category} className="rounded-full bg-chicano-black/5 px-2 py-0.5 text-xs text-chicano-black">
                {checkCategoryLabel(c.category)} : {checkResultLabel(c.result)}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
