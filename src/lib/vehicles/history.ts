import { db } from "@/lib/db";
import { workOrderItemTypeLabel } from "@/lib/work-orders/options";
import { maintenanceTypeLabel } from "@/lib/maintenance/options";
import { getVehicleForCustomer } from "./service";
import type { MaintenanceType, WorkOrderItemType } from "@prisma/client";

// Historique véhicule (Phase 8) — RÈGLE FONDAMENTALE : pas de deuxième
// historique parallèle. Cette fonction ne fait qu'agréger et trier les
// événements métier déjà existants (ServiceRequest, DiagnosticReport publié,
// WorkOrder terminé) — aucune nouvelle table de données dupliquées.
//
// Chaque source est plafonnée (SOURCE_LIMIT) avant fusion pour ne jamais
// charger un historique sans limite (section "PERFORMANCE") ; la pagination
// se fait ensuite en mémoire sur le résultat fusionné et trié.

export type VehicleHistoryCategory = "DIAGNOSTIC" | "MAINTENANCE" | "REPAIR" | "TECHNICAL_VISIT" | "OTHER";

export interface VehicleHistoryEvent {
  id: string;
  date: Date;
  category: VehicleHistoryCategory;
  title: string;
  subtitle: string | null;
  status: string | null;
  technicianName: string | null;
  mileage: number | null;
  href: string | null;
}

const SOURCE_LIMIT = 50;
const DEFAULT_PAGE_SIZE = 20;

function workOrderCategory(items: { maintenanceType: MaintenanceType | null }[]): VehicleHistoryCategory {
  const maintenanceTypes = items.map((i) => i.maintenanceType).filter((t): t is MaintenanceType => t !== null);
  if (maintenanceTypes.includes("TECHNICAL_INSPECTION")) return "TECHNICAL_VISIT";
  if (maintenanceTypes.length > 0) return "MAINTENANCE";
  return "REPAIR";
}

async function fetchServiceRequestEvents(vehicleId: string): Promise<VehicleHistoryEvent[]> {
  const requests = await db.serviceRequest.findMany({
    where: { vehicleId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    select: { id: true, referenceNumber: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: SOURCE_LIMIT,
  });

  return requests.map((r) => ({
    id: `sr-${r.id}`,
    date: r.createdAt,
    category: "OTHER" as const,
    title: "Demande de service",
    subtitle: r.referenceNumber,
    status: r.status,
    technicianName: null,
    mileage: null,
    href: `/espace-client/demandes/${r.id}`,
  }));
}

async function fetchDiagnosticReportEvents(vehicleId: string): Promise<VehicleHistoryEvent[]> {
  const reports = await db.diagnosticReport.findMany({
    where: { publishedAt: { not: null }, diagnostic: { vehicleId } },
    select: {
      id: true,
      reportNumber: true,
      severity: true,
      publishedAt: true,
      diagnostic: {
        select: { mileageAtVisit: true, technician: { select: { user: { select: { firstName: true, lastName: true } } } } },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: SOURCE_LIMIT,
  });

  return reports.map((r) => ({
    id: `dr-${r.id}`,
    date: r.publishedAt as Date,
    category: "DIAGNOSTIC" as const,
    title: "Diagnostic",
    subtitle: r.reportNumber,
    status: r.severity,
    technicianName: r.diagnostic.technician
      ? `${r.diagnostic.technician.user.firstName} ${r.diagnostic.technician.user.lastName}`
      : null,
    mileage: r.diagnostic.mileageAtVisit,
    href: `/espace-client/rapports/${r.id}`,
  }));
}

async function fetchWorkOrderEvents(vehicleId: string): Promise<VehicleHistoryEvent[]> {
  const workOrders = await db.workOrder.findMany({
    where: { vehicleId, status: "COMPLETED" },
    select: {
      id: true,
      workOrderNumber: true,
      qualityCheckedAt: true,
      updatedAt: true,
      technician: { select: { user: { select: { firstName: true, lastName: true } } } },
      items: { select: { type: true, description: true, maintenanceType: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: SOURCE_LIMIT,
  });

  return workOrders.map((wo) => {
    const category = workOrderCategory(wo.items);
    const label = category === "REPAIR" ? "Réparation" : category === "TECHNICAL_VISIT" ? "Visite technique" : "Entretien";
    const maintenanceTypes = [...new Set(wo.items.map((i) => i.maintenanceType).filter((t): t is MaintenanceType => t !== null))];
    const firstItemType: WorkOrderItemType | undefined = wo.items[0]?.type;
    const subtitle =
      maintenanceTypes.length > 0
        ? maintenanceTypes.map((t) => maintenanceTypeLabel(t)).join(", ")
        : wo.items
            .slice(0, 2)
            .map((i) => i.description)
            .join(", ") || (firstItemType ? workOrderItemTypeLabel(firstItemType) : null);

    return {
      id: `wo-${wo.id}`,
      date: wo.qualityCheckedAt ?? wo.updatedAt,
      category,
      title: label,
      subtitle: subtitle || null,
      status: wo.workOrderNumber,
      technicianName: wo.technician ? `${wo.technician.user.firstName} ${wo.technician.user.lastName}` : null,
      mileage: null,
      href: `/espace-client/reparations/${wo.id}`,
    };
  });
}

export async function getVehicleHistory(
  vehicleId: string,
  options: { category?: VehicleHistoryCategory; limit?: number; offset?: number } = {}
) {
  const [serviceRequests, diagnosticReports, workOrders] = await Promise.all([
    fetchServiceRequestEvents(vehicleId),
    fetchDiagnosticReportEvents(vehicleId),
    fetchWorkOrderEvents(vehicleId),
  ]);

  let events = [...serviceRequests, ...diagnosticReports, ...workOrders].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  if (options.category) {
    events = events.filter((e) => e.category === options.category);
  }

  const offset = options.offset ?? 0;
  const limit = options.limit ?? DEFAULT_PAGE_SIZE;
  const page = events.slice(offset, offset + limit);

  return { events: page, total: events.length, hasMore: offset + limit < events.length };
}

// Ownership client — même discipline 404 que le reste de la plateforme
// (getVehicleForCustomer lève VehicleNotFoundError si le véhicule
// n'appartient pas à ce client).
export async function getVehicleHistoryForCustomer(
  customerId: string,
  vehicleId: string,
  options: { category?: VehicleHistoryCategory; limit?: number; offset?: number } = {}
) {
  await getVehicleForCustomer(customerId, vehicleId);
  return getVehicleHistory(vehicleId, options);
}
