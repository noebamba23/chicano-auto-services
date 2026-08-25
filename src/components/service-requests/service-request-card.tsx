import Link from "next/link";
import type { ServiceRequest, Vehicle } from "@prisma/client";
import { serviceCategoryLabel, serviceRequestStatusLabel } from "@/lib/service-requests/options";

type RequestWithVehicle = ServiceRequest & { vehicle: Vehicle };

export function ServiceRequestCard({ request, href }: { request: RequestWithVehicle; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-chicano-gray-light bg-white p-4 hover:border-chicano-red"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-chicano-black">{request.referenceNumber}</p>
        {request.isUrgent && (
          <span className="shrink-0 rounded-full bg-chicano-red/10 px-2 py-1 text-xs font-semibold text-chicano-red">
            🔴 Urgent
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-chicano-black">
        {request.vehicle.make} {request.vehicle.model}
      </p>
      <p className="text-sm text-chicano-gray">{serviceCategoryLabel(request.category)}</p>
      <p className="mt-1 text-xs text-chicano-gray">
        {request.interventionType === "MOBILE" ? "📍 Intervention mobile" : "🏭 Au garage"}
      </p>
      <p className="mt-2 text-sm font-medium text-chicano-black">{serviceRequestStatusLabel(request.status)}</p>
    </Link>
  );
}
