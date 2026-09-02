import { randomUUID } from "crypto";

// Fake Prisma minimal dédié aux tests de src/lib/service-requests/service.ts
// et src/lib/appointments/service.ts — même principe et mêmes limites que
// src/lib/vehicles/test-utils/fake-db.ts (voir ce fichier pour le détail de
// ce qu'un tel fake couvre et ne couvre PAS). Fichier séparé plutôt que
// réutilisé/étendu pour ne prendre aucun risque sur les tests véhicules
// existants de la Phase 2 (consigne explicite : ne pas les casser).

type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true; // pas de filtre (ex. findMany({ select: ... }) sans where)
  for (const key of Object.keys(where)) {
    const condition = where[key];
    if (condition === undefined) continue; // filtre non appliqué (ex. filtres production optionnels)
    if (key === "NOT") {
      if (matches(row, condition as Record<string, unknown>)) return false;
      continue;
    }
    // Raccourci Prisma par champ : { status: { not: "X" } }, distinct du NOT
    // de premier niveau (objet de condition complet) géré ci-dessus.
    if (condition !== null && typeof condition === "object" && "not" in condition) {
      if (row[key] === (condition as { not: unknown }).not) return false;
      continue;
    }
    // Raccourci Prisma { status: { in: ["A", "B"] } } — ajouté en Phase 6
    // pour createQuote() (recherche d'un devis actif parmi plusieurs statuts).
    if (condition !== null && typeof condition === "object" && "in" in condition) {
      if (!(condition as { in: unknown[] }).in.includes(row[key])) return false;
      continue;
    }
    // { status: { notIn: ["A", "B"] } } — ajouté en Phase 8 pour
    // history.ts (exclut les ServiceRequest DRAFT/CANCELLED de la timeline).
    if (condition !== null && typeof condition === "object" && "notIn" in condition) {
      if ((condition as { notIn: unknown[] }).notIn.includes(row[key])) return false;
      continue;
    }
    // { dueAt: { lte: ... } } etc. — ajouté en Phase 10 (relances/rappels
    // CRM : premières comparaisons d'ordre nécessaires dans ce fake db).
    if (
      condition !== null &&
      typeof condition === "object" &&
      ("lte" in condition || "gte" in condition || "lt" in condition || "gt" in condition)
    ) {
      const c = condition as { lte?: unknown; gte?: unknown; lt?: unknown; gt?: unknown };
      const val = row[key] as never;
      if (c.lte !== undefined && !(val <= (c.lte as never))) return false;
      if (c.gte !== undefined && !(val >= (c.gte as never))) return false;
      if (c.lt !== undefined && !(val < (c.lt as never))) return false;
      if (c.gt !== undefined && !(val > (c.gt as never))) return false;
      continue;
    }
    if (row[key] !== condition) return false;
  }
  return true;
}

function applyOrder(rows: Row[], orderBy: unknown): Row[] {
  if (!orderBy) return rows;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const order of orders as Record<string, "asc" | "desc">[]) {
      const [field, dir] = Object.entries(order)[0] as [string, "asc" | "desc"];
      if (a[field] === b[field]) continue;
      const cmp = (a[field] as never) > (b[field] as never) ? 1 : -1;
      return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

export function createFakeDb() {
  let vehicles: Row[] = [];
  let customers: Row[] = []; // { id, userId }
  let serviceRequests: Row[] = [];
  let requestLocations: Row[] = [];
  let appointments: Row[] = [];
  let appointmentLocations: Row[] = [];
  let auditLogs: Row[] = [];
  let technicians: Row[] = [];
  let technicianAssignments: Row[] = [];
  let diagnostics: Row[] = [];
  let diagnosticChecks: Row[] = [];
  let diagnosticFaultCodes: Row[] = [];
  let diagnosticReports: Row[] = [];
  let reportPhotos: Row[] = [];
  let quotes: Row[] = [];
  let quoteVersions: Row[] = [];
  let quoteItems: Row[] = [];
  let workOrders: Row[] = [];
  let workOrderItems: Row[] = [];
  let workOrderParts: Row[] = [];
  let workOrderPhotos: Row[] = [];
  let workshopTransfers: Row[] = [];
  let maintenancePlans: Row[] = [];
  let maintenanceReminders: Row[] = [];
  let mileageReadings: Row[] = [];
  let invoices: Row[] = [];
  let invoiceItems: Row[] = [];
  let payments: Row[] = [];
  let nextSrSequence = 1;
  let nextReportSequence = 1;
  let nextQuoteSequence = 1;
  let nextWorkOrderSequence = 1;
  let nextInvoiceSequence = 1;
  let nextPaymentSequence = 1;

  function withRequestExtras(row: Row) {
    return {
      ...row,
      location: requestLocations.find((l) => l.serviceRequestId === row.id) ?? null,
      attachments: [],
      appointment: appointments.find((a) => a.serviceRequestId === row.id) ?? null,
      vehicle: vehicles.find((v) => v.id === row.vehicleId) ?? null,
    };
  }

  // Vue enrichie d'une affectation avec son rendez-vous (Phase 5 — espace
  // technicien) : le technicien/le diagnostic n'ont besoin que de champs
  // précis de cette relation imbriquée (customer.userId pour les
  // notifications, vehicleId/serviceRequestId pour le fil métier) — pas
  // d'une réplique fidèle complète de la forme Prisma (même limite déjà
  // documentée pour withRequestExtras : ce fake teste la logique
  // applicative, pas la forme d'affichage, vérifiée en conditions réelles
  // via Neon + navigateur).
  function withAssignmentAppointment(row: Row) {
    const apt = appointments.find((a) => a.id === row.appointmentId);
    if (!apt) return { ...row, appointment: null };
    const sr = serviceRequests.find((s) => s.id === apt.serviceRequestId);
    const customer = customers.find((c) => c.id === apt.customerId);
    return {
      ...row,
      appointment: {
        ...apt,
        serviceRequest: sr ? { referenceNumber: sr.referenceNumber, category: sr.category, isUrgent: sr.isUrgent } : null,
        vehicle: vehicles.find((v) => v.id === apt.vehicleId) ?? null,
        customer: customer ? { userId: customer.userId } : null,
        location: appointmentLocations.find((l) => l.appointmentId === apt.id) ?? null,
        diagnostics: diagnostics.filter((d) => d.appointmentId === apt.id),
      },
    };
  }

  function withDiagnosticExtras(row: Row) {
    return {
      ...row,
      checks: diagnosticChecks.filter((c) => c.diagnosticId === row.id),
      faultCodes: diagnosticFaultCodes
        .filter((f) => f.diagnosticId === row.id)
        .sort((a, b) => +new Date(a.createdAt as string) - +new Date(b.createdAt as string)),
      vehicle: vehicles.find((v) => v.id === row.vehicleId) ?? null,
      appointment: (() => {
        const apt = appointments.find((a) => a.id === row.appointmentId);
        if (!apt) return null;
        const sr = serviceRequests.find((s) => s.id === apt.serviceRequestId);
        return { id: apt.id, serviceRequest: sr ? { referenceNumber: sr.referenceNumber } : null };
      })(),
    };
  }

  // Phase 6 — même limite documentée pour withDiagnosticExtras : forme
  // suffisante pour la logique applicative testée, pas une réplique fidèle
  // complète de la forme Prisma (ex. diagnostic.appointment reste null ici,
  // aucun test n'en a besoin — vérifié en conditions réelles via Neon).
  function withReportExtras(row: Row) {
    const diagnostic = diagnostics.find((d) => d.id === row.diagnosticId);
    const vehicle = diagnostic ? (vehicles.find((v) => v.id === diagnostic.vehicleId) ?? null) : null;
    return {
      ...row,
      photos: reportPhotos.filter((p) => p.reportId === row.id),
      diagnostic: diagnostic
        ? {
            id: diagnostic.id,
            symptoms: diagnostic.symptoms,
            mileageAtVisit: diagnostic.mileageAtVisit,
            checks: diagnosticChecks.filter((c) => c.diagnosticId === diagnostic.id),
            faultCodes: diagnosticFaultCodes.filter((f) => f.diagnosticId === diagnostic.id),
            vehicle,
            appointment: null,
          }
        : null,
    };
  }

  // where.diagnostic.vehicle.customerId (relation imbriquée à 2 niveaux) :
  // hors de portée de matches() générique, géré ici spécifiquement pour
  // listPublishedReportsForCustomer()/getPublishedReportForCustomer().
  function matchesReportWhere(row: Row, where: Record<string, unknown>): boolean {
    const { diagnostic: diagnosticWhere, ...flat } = where as {
      diagnostic?: { vehicle?: { customerId?: string }; vehicleId?: string };
    } & Record<string, unknown>;
    if (!matches(row, flat)) return false;
    if (diagnosticWhere?.vehicle?.customerId !== undefined) {
      const diag = diagnostics.find((d) => d.id === row.diagnosticId);
      const veh = diag ? vehicles.find((v) => v.id === diag.vehicleId) : null;
      if (!veh || veh.customerId !== diagnosticWhere.vehicle.customerId) return false;
    }
    // Phase 8 — src/lib/vehicles/history.ts interroge diagnostic.vehicleId
    // directement (pas via vehicle.customerId, l'ownership est déjà vérifiée
    // en amont par getVehicleForCustomer côté appelant).
    if (diagnosticWhere?.vehicleId !== undefined) {
      const diag = diagnostics.find((d) => d.id === row.diagnosticId);
      if (!diag || diag.vehicleId !== diagnosticWhere.vehicleId) return false;
    }
    return true;
  }

  // Phase 7 — le diagnostic imbriqué expose désormais aussi appointmentId/
  // appointment/report (nécessaires à createWorkOrderFromQuote(), voir
  // src/lib/work-orders/service.ts), en plus de la forme déjà utilisée par
  // QUOTE_INCLUDE (diagnostic.appointment.serviceRequest.referenceNumber).
  function withQuoteExtras(row: Row) {
    const diagnostic = diagnostics.find((d) => d.id === row.diagnosticId);
    const appointment = diagnostic ? appointments.find((a) => a.id === diagnostic.appointmentId) : null;
    const sr = appointment ? serviceRequests.find((s) => s.id === appointment.serviceRequestId) : null;
    const report = diagnostic ? diagnosticReports.find((r) => r.diagnosticId === diagnostic.id) : null;
    return {
      ...row,
      vehicle: vehicles.find((v) => v.id === row.vehicleId) ?? null,
      diagnostic: diagnostic
        ? {
            id: diagnostic.id,
            appointmentId: diagnostic.appointmentId,
            appointment: appointment
              ? {
                  serviceRequestId: appointment.serviceRequestId,
                  scheduledDate: appointment.scheduledDate ?? null,
                  serviceRequest: sr ? { referenceNumber: sr.referenceNumber } : null,
                }
              : null,
            report: report ? { id: report.id } : null,
          }
        : null,
      versions: quoteVersions
        .filter((v) => v.quoteId === row.id)
        .sort((a, b) => (a.versionNumber as number) - (b.versionNumber as number))
        .map((v) => ({ ...v, items: quoteItems.filter((it) => it.quoteVersionId === v.id) })),
    };
  }

  // where.vehicle.customerId : même limite que matchesReportWhere ci-dessus.
  function matchesQuoteWhere(row: Row, where: Record<string, unknown>): boolean {
    const { vehicle: vehicleWhere, ...flat } = where as { vehicle?: { customerId?: string } } & Record<string, unknown>;
    if (!matches(row, flat)) return false;
    if (vehicleWhere?.customerId !== undefined) {
      const veh = vehicles.find((v) => v.id === row.vehicleId);
      if (!veh || veh.customerId !== vehicleWhere.customerId) return false;
    }
    return true;
  }

  function genericModel(store: { get: () => Row[]; set: (rows: Row[]) => void }, defaults: Record<string, unknown>) {
    return {
      async create({ data }: { data: Record<string, unknown> }) {
        const row: Row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data } as Row;
        store.set([...store.get(), row]);
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = store.get().find((r) => r.id === where.id);
        if (!row) throw new Error("Record to update not found.");
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      async findUnique({ where }: { where: Record<string, unknown> }) {
        return store.get().find((r) => matches(r, where)) ?? null;
      },
      async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
        const rows = applyOrder(store.get().filter((r) => matches(r, where)), orderBy);
        return rows[0] ?? null;
      },
      async findMany({
        where,
        orderBy,
        skip,
        take,
      }: {
        where: Record<string, unknown>;
        orderBy?: unknown;
        skip?: number;
        take?: number;
      }) {
        let rows = applyOrder(store.get().filter((r) => matches(r, where)), orderBy);
        if (skip) rows = rows.slice(skip);
        if (take !== undefined) rows = rows.slice(0, take);
        return rows;
      },
      async count({ where }: { where: Record<string, unknown> }) {
        return store.get().filter((r) => matches(r, where)).length;
      },
    };
  }

  const vehicleModel = {
    ...genericModel(
      { get: () => vehicles, set: (r) => (vehicles = r) },
      { status: "ACTIVE" }
    ),
    // where.maintenancePlans.none: {} — Phase 8, "véhicules sans plan"
    // (listMaintenanceOverviewForProduction) : hors de portée de matches()
    // générique, géré ici spécifiquement.
    async findMany({ where, orderBy, take }: { where: Record<string, unknown>; orderBy?: unknown; take?: number }) {
      const { maintenancePlans: plansWhere, ...flat } = where as { maintenancePlans?: { none?: unknown } } & Record<string, unknown>;
      let rows = applyOrder(vehicles.filter((r) => matches(r, flat)), orderBy);
      if (plansWhere?.none !== undefined) {
        rows = rows.filter((v) => !maintenancePlans.some((p) => p.vehicleId === v.id));
      }
      return take ? rows.slice(0, take) : rows;
    },
  };

  const customerModel = genericModel({ get: () => customers, set: (r) => (customers = r) }, {});

  const serviceRequestModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextSrSequence++,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SUBMITTED",
        ...data,
      };
      serviceRequests.push(row);
      return withRequestExtras(row);
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = serviceRequests.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return withRequestExtras(row);
    },
    async findUnique({ where, include }: { where: { id: string }; include?: unknown }) {
      const row = serviceRequests.find((r) => r.id === where.id);
      if (!row) return null;
      if (include) return withRequestExtras(row);
      return row;
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      const row = serviceRequests.find((r) => matches(r, where));
      return row ? withRequestExtras(row) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(serviceRequests.filter((r) => matches(r, where)), orderBy);
      return rows.map(withRequestExtras);
    },
  };

  const requestLocationModel = genericModel({ get: () => requestLocations, set: (r) => (requestLocations = r) }, {});

  const appointmentModel = {
    ...genericModel({ get: () => appointments, set: (r) => (appointments = r) }, { status: "PENDING" }),
    async upsert({
      where,
      create,
      update,
    }: {
      where: { serviceRequestId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const existing = appointments.find((a) => a.serviceRequestId === where.serviceRequestId);
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      const row: Row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create } as Row;
      appointments.push(row);
      return row;
    },
  };

  const appointmentLocationModel = {
    ...genericModel({ get: () => appointmentLocations, set: (r) => (appointmentLocations = r) }, {}),
    async upsert({
      where,
      create,
    }: {
      where: { appointmentId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const existing = appointmentLocations.find((a) => a.appointmentId === where.appointmentId);
      if (existing) return existing;
      const row: Row = { id: randomUUID(), createdAt: new Date(), ...create } as Row;
      appointmentLocations.push(row);
      return row;
    },
  };

  const auditLogModel = genericModel({ get: () => auditLogs, set: (r) => (auditLogs = r) }, {});

  const technicianModel = {
    ...genericModel({ get: () => technicians, set: (r) => (technicians = r) }, {}),
    async findMany() {
      return technicians.map((t) => ({ ...t, user: t.user }));
    },
  };

  // technicianAssignment.findFirst sert deux formes de requête distinctes :
  // la vérification de double-réservation (Phase 4 — where.appointment
  // filtre sur un rendez-vous imbriqué autre que le sien, que matches()
  // générique ne peut pas exprimer) et le lookup d'ownership technicien
  // (Phase 5 — where.id/.technicianId, champs plats). Deux branches plutôt
  // qu'un matcher unique pour ne pas complexifier matches() avec un cas très
  // spécifique à une seule requête métier.
  const technicianAssignmentModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        status: "ASSIGNED",
        departedAt: null,
        arrivedAt: null,
        ...data,
      } as Row;
      technicianAssignments.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = technicianAssignments.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const rows = technicianAssignments.filter((r) => matches(r, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
    async findFirst({
      where,
    }: {
      where: Record<string, unknown> & {
        appointment?: { scheduledDate: unknown; scheduledSlot: unknown; id: { not: string } };
      };
    }) {
      if (where.appointment) {
        const appointmentWhere = where.appointment;
        const found = technicianAssignments.find((ta) => {
          if (where.technicianId !== undefined && ta.technicianId !== where.technicianId) return false;
          const statusCond = where.status as { not?: string } | undefined;
          if (statusCond?.not && ta.status === statusCond.not) return false;
          const apt = appointments.find((a) => a.id === ta.appointmentId);
          if (!apt) return false;
          if (apt.id === appointmentWhere.id.not) return false;
          if (+new Date(apt.scheduledDate as string) !== +new Date(appointmentWhere.scheduledDate as string))
            return false;
          if (apt.scheduledSlot !== appointmentWhere.scheduledSlot) return false;
          return true;
        });
        return found ?? null;
      }

      const found = technicianAssignments.find((ta) => matches(ta, where));
      return found ? withAssignmentAppointment(found) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(technicianAssignments.filter((r) => matches(r, where)), orderBy);
      return rows.map(withAssignmentAppointment);
    },
  };

  const diagnosticModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), startedAt: new Date(), completedAt: null, ...data } as Row;
      diagnostics.push(row);
      return withDiagnosticExtras(row);
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = diagnostics.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return withDiagnosticExtras(row);
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const row = diagnostics.find((r) => matches(r, where));
      return row ? withDiagnosticExtras(row) : null;
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(diagnostics.filter((r) => matches(r, where)), orderBy);
      return rows[0] ? withDiagnosticExtras(rows[0]) : null;
    },
  };

  const diagnosticCheckModel = {
    async upsert({
      where,
      create,
      update,
    }: {
      where: { diagnosticId_category: { diagnosticId: string; category: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const key = where.diagnosticId_category;
      const existing = diagnosticChecks.find((c) => c.diagnosticId === key.diagnosticId && c.category === key.category);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row: Row = { id: randomUUID(), ...create } as Row;
      diagnosticChecks.push(row);
      return row;
    },
  };

  const diagnosticFaultCodeModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), createdAt: new Date(), ...data } as Row;
      diagnosticFaultCodes.push(row);
      return row;
    },
    async delete({ where }: { where: { id: string } }) {
      const idx = diagnosticFaultCodes.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error("Record to delete not found.");
      const [removed] = diagnosticFaultCodes.splice(idx, 1);
      return removed;
    },
  };

  const diagnosticReportModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextReportSequence++,
        createdAt: new Date(),
        conclusion: null,
        severity: "NORMAL",
        publishedAt: null,
        publishedById: null,
        ...data,
      } as Row;
      diagnosticReports.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = diagnosticReports.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return withReportExtras(row);
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const row = diagnosticReports.find((r) => matches(r, where));
      return row ? withReportExtras(row) : null;
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      const row = diagnosticReports.find((r) => matchesReportWhere(r, where));
      return row ? withReportExtras(row) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(diagnosticReports.filter((r) => matchesReportWhere(r, where)), orderBy);
      return rows.map(withReportExtras);
    },
  };

  const reportPhotoModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), caption: null, ...data } as Row;
      reportPhotos.push(row);
      return row;
    },
    async delete({ where }: { where: { id: string } }) {
      const idx = reportPhotos.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error("Record to delete not found.");
      const [removed] = reportPhotos.splice(idx, 1);
      return removed;
    },
  };

  const quoteModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextQuoteSequence++,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentVersion: 1,
        status: "DRAFT",
        totalAmount: null,
        currency: "XOF",
        acceptedAt: null,
        acceptedById: null,
        ...data,
      } as Row;
      quotes.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = quotes.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return withQuoteExtras(row);
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const row = quotes.find((r) => matches(r, where));
      return row ? withQuoteExtras(row) : null;
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(quotes.filter((r) => matchesQuoteWhere(r, where)), orderBy);
      return rows[0] ? withQuoteExtras(rows[0]) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(quotes.filter((r) => matchesQuoteWhere(r, where)), orderBy);
      return rows.map(withQuoteExtras);
    },
  };

  const quoteVersionModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), createdAt: new Date(), ...data } as Row;
      quoteVersions.push(row);
      return row;
    },
    async findUnique({
      where,
    }: {
      where: { quoteId_versionNumber: { quoteId: string; versionNumber: number } };
    }) {
      const key = where.quoteId_versionNumber;
      const row = quoteVersions.find((v) => v.quoteId === key.quoteId && v.versionNumber === key.versionNumber);
      if (!row) return null;
      return { ...row, items: quoteItems.filter((it) => it.quoteVersionId === row.id) };
    },
  };

  const quoteItemModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), partId: null, ...data } as Row;
      quoteItems.push(row);
      return row;
    },
  };

  // Phase 7 — Work Order. Même limite documentée pour withReportExtras/
  // withQuoteExtras : forme suffisante pour la logique applicative testée,
  // pas une réplique fidèle complète de la forme Prisma (ex. customer.user/
  // technician.user restent tels que seedés, souvent absents — vérifié en
  // conditions réelles via Neon).
  function withWorkOrderExtras(row: Row) {
    const customer = customers.find((c) => c.id === row.customerId) ?? null;
    const serviceRequest = serviceRequests.find((s) => s.id === row.serviceRequestId) ?? null;
    const appointment = appointments.find((a) => a.id === row.appointmentId) ?? null;
    const quote = quotes.find((q) => q.id === row.quoteId) ?? null;
    const diagnosticReport = diagnosticReports.find((r) => r.id === row.diagnosticReportId) ?? null;
    const technician = technicians.find((t) => t.id === row.technicianId) ?? null;
    return {
      ...row,
      customer,
      vehicle: vehicles.find((v) => v.id === row.vehicleId) ?? null,
      serviceRequest: serviceRequest
        ? {
            id: serviceRequest.id,
            referenceNumber: serviceRequest.referenceNumber,
            category: serviceRequest.category,
            interventionType: serviceRequest.interventionType,
          }
        : null,
      appointment: appointment
        ? { id: appointment.id, scheduledDate: appointment.scheduledDate ?? null, scheduledSlot: appointment.scheduledSlot ?? null }
        : null,
      quote: quote
        ? { id: quote.id, quoteNumber: quote.quoteNumber, currentVersion: quote.currentVersion, totalAmount: quote.totalAmount, currency: quote.currency }
        : null,
      diagnosticReport: diagnosticReport
        ? { id: diagnosticReport.id, reportNumber: diagnosticReport.reportNumber, conclusion: diagnosticReport.conclusion, severity: diagnosticReport.severity }
        : null,
      technician,
      items: workOrderItems.filter((i) => i.workOrderId === row.id),
      parts: workOrderParts.filter((p) => p.workOrderId === row.id),
      photos: workOrderPhotos.filter((p) => p.workOrderId === row.id),
      transfer: workshopTransfers.find((t) => t.workOrderId === row.id) ?? null,
      // Phase 9 — nécessaire à computeWorkOrderMargin() (src/lib/billing/service.ts).
      invoice: invoices.find((inv) => inv.workOrderId === row.id) ?? null,
    };
  }

  const workOrderModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextWorkOrderSequence++,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "DRAFT",
        priority: "NORMAL",
        appointmentId: null,
        diagnosticReportId: null,
        technicianId: null,
        scheduledDate: null,
        internalNotes: null,
        qualityCheckPassed: null,
        qualityCheckNotes: null,
        qualityCheckedById: null,
        qualityCheckedAt: null,
        testDrivePerformed: false,
        testDriveNotes: null,
        additionalWorkRequested: false,
        additionalWorkNotes: null,
        requiresTowing: false,
        ...data,
      } as Row;
      workOrders.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = workOrders.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return withWorkOrderExtras(row);
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const row = workOrders.find((r) => matches(r, where));
      return row ? withWorkOrderExtras(row) : null;
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(workOrders.filter((r) => matches(r, where)), orderBy);
      return rows[0] ? withWorkOrderExtras(rows[0]) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(workOrders.filter((r) => matches(r, where)), orderBy);
      return rows.map(withWorkOrderExtras);
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return workOrders.filter((r) => matches(r, where)).length;
    },
  };

  const workOrderItemModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        status: "PENDING",
        unit: null,
        unitPrice: null,
        totalPrice: null,
        sourceQuoteItemId: null,
        estimatedMinutes: null,
        actualMinutes: null,
        technicianId: null,
        maintenanceType: null,
        ...data,
      } as Row;
      workOrderItems.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = workOrderItems.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return row;
    },
  };

  const workOrderPartModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "REQUESTED",
        reference: null,
        notes: null,
        partId: null,
        ...data,
      } as Row;
      workOrderParts.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = workOrderParts.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
  };

  const workOrderPhotoModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), createdAt: new Date(), storageKey: null, caption: null, ...data } as Row;
      workOrderPhotos.push(row);
      return row;
    },
  };

  const workshopTransferModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        transferredAt: new Date(),
        receivedAt: null,
        vehicleCondition: null,
        photoUrls: [],
        destination: null,
        transferredById: null,
        ...data,
      } as Row;
      workshopTransfers.push(row);
      return row;
    },
    async update({ where, data }: { where: { workOrderId: string }; data: Record<string, unknown> }) {
      const row = workshopTransfers.find((r) => r.workOrderId === where.workOrderId);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return row;
    },
  };

  // Phase 8 — carnet automobile. matches() générique suffit (pas de champ
  // imbriqué requis dans les where des services maintenance).
  const maintenancePlanModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        intervalKm: null,
        intervalMonths: null,
        priority: "NORMAL",
        isActive: true,
        lastDoneAt: null,
        lastDoneMileage: null,
        ...data,
      } as Row;
      maintenancePlans.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = maintenancePlans.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      return maintenancePlans.find((r) => matches(r, where)) ?? null;
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(maintenancePlans.filter((r) => matches(r, where)), orderBy);
      return rows[0] ?? null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      return applyOrder(maintenancePlans.filter((r) => matches(r, where)), orderBy);
    },
  };

  const maintenanceReminderModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        planId: null,
        dueAt: null,
        dueMileage: null,
        priority: "NORMAL",
        status: "SCHEDULED",
        notes: null,
        lastNotifiedLevel: null,
        lastNotifiedAt: null,
        completedByWorkOrderId: null,
        completedAt: null,
        cancelledAt: null,
        ...data,
      } as Row;
      maintenanceReminders.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = maintenanceReminders.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const rows = maintenanceReminders.filter((r) => matches(r, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      return maintenanceReminders.find((r) => matches(r, where)) ?? null;
    },
    // where.vehicle.customerId (ownership) — même limite que matchesQuoteWhere.
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const { vehicle: vehicleWhere, ...flat } = where as { vehicle?: { customerId?: string } } & Record<string, unknown>;
      const rows = applyOrder(
        maintenanceReminders.filter((r) => {
          if (!matches(r, flat)) return false;
          if (vehicleWhere?.customerId !== undefined) {
            const veh = vehicles.find((v) => v.id === r.vehicleId);
            if (!veh || veh.customerId !== vehicleWhere.customerId) return false;
          }
          return true;
        }),
        orderBy
      );
      return rows[0] ?? null;
    },
    // where.vehicle.customerId + attache la relation vehicle si demandée via
    // include OU select imbriqué (Phase 10 — src/lib/crm/segmentation.ts,
    // dashboard.ts, customer360.ts interrogent tous les rappels actifs avec
    // leur véhicule, parfois filtrés par client).
    async findMany({
      where,
      orderBy,
      include,
      select,
    }: {
      where: Record<string, unknown>;
      orderBy?: unknown;
      include?: { vehicle?: unknown };
      select?: { vehicle?: unknown };
    }) {
      const { vehicle: vehicleWhere, ...flat } = where as { vehicle?: { customerId?: string } } & Record<string, unknown>;
      const rows = applyOrder(
        maintenanceReminders.filter((r) => {
          if (!matches(r, flat)) return false;
          if (vehicleWhere?.customerId !== undefined) {
            const veh = vehicles.find((v) => v.id === r.vehicleId);
            if (!veh || veh.customerId !== vehicleWhere.customerId) return false;
          }
          return true;
        }),
        orderBy
      );
      if (!include?.vehicle && !select?.vehicle) return rows;
      return rows.map((r) => ({ ...r, vehicle: vehicles.find((v) => v.id === r.vehicleId) ?? null }));
    },
  };

  const mileageReadingModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), recordedAt: new Date(), source: "CUSTOMER", notes: null, ...data } as Row;
      mileageReadings.push(row);
      return row;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      return applyOrder(mileageReadings.filter((r) => matches(r, where)), orderBy);
    },
  };

  // Phase 9 — facturation. withInvoiceExtras reproduit INVOICE_INCLUDE
  // (src/lib/billing/service.ts) : customer/vehicle/workOrder imbriqués,
  // items/payments par relation inverse — même limite documentée partout
  // ailleurs dans ce fichier (forme suffisante pour la logique applicative,
  // pas une réplique fidèle complète, vérifiée en conditions réelles via
  // Neon).
  function withInvoiceExtras(row: Row) {
    const customer = customers.find((c) => c.id === row.customerId) ?? null;
    const vehicle = vehicles.find((v) => v.id === row.vehicleId) ?? null;
    const workOrder = workOrders.find((w) => w.id === row.workOrderId) ?? null;
    return {
      ...row,
      customer,
      vehicle,
      workOrder: workOrder ? { id: workOrder.id, workOrderNumber: workOrder.workOrderNumber } : null,
      items: applyOrder(invoiceItems.filter((i) => i.invoiceId === row.id), { id: "asc" }),
      payments: applyOrder(payments.filter((p) => p.invoiceId === row.id), { createdAt: "asc" }),
    };
  }

  const invoiceModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextInvoiceSequence++,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "DRAFT",
        subtotal: 0,
        discount: 0,
        travelFee: 0,
        tax: 0,
        total: 0,
        amountPaid: 0,
        balanceDue: 0,
        currency: "XOF",
        quoteId: null,
        quoteVersionNumber: null,
        issuedAt: null,
        dueAt: null,
        paidAt: null,
        ...data,
      } as Row;
      invoices.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = invoices.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return withInvoiceExtras(row);
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const row = invoices.find((r) => matches(r, where));
      return row ? withInvoiceExtras(row) : null;
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(invoices.filter((r) => matches(r, where)), orderBy);
      return rows[0] ? withInvoiceExtras(rows[0]) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(invoices.filter((r) => matches(r, where)), orderBy);
      return rows.map(withInvoiceExtras);
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return invoices.filter((r) => matches(r, where)).length;
    },
  };

  const invoiceItemModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), unit: null, sourceWorkOrderItemId: null, ...data } as Row;
      invoiceItems.push(row);
      return row;
    },
  };

  const paymentModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextPaymentSequence++,
        createdAt: new Date(),
        status: "PENDING",
        externalReference: null,
        transactionReference: null,
        proofUrl: null,
        notes: null,
        receiptNumber: null,
        paidAt: null,
        ...data,
      } as Row;
      payments.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = payments.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return row;
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      return payments.find((r) => matches(r, where)) ?? null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      return applyOrder(payments.filter((r) => matches(r, where)), orderBy);
    },
  };

  // Phase 10 — CRM & CHICANO CARE. carePlans/careSubscriptions distincts
  // (careSubscription a besoin d'un include carePlan/vehicle, les autres
  // sont de purs genericModel — même limite documentée partout ailleurs
  // dans ce fichier : forme suffisante pour la logique applicative testée).
  let campaigns: Row[] = [];
  let carePlans: Row[] = [];
  let careSubscriptions: Row[] = [];
  let customerInteractions: Row[] = [];
  let followUps: Row[] = [];
  let referrals: Row[] = [];

  const campaignModel = genericModel(
    { get: () => campaigns, set: (r) => (campaigns = r) },
    { status: "DRAFT", scheduledAt: null, sentCount: 0, skippedCount: 0 }
  );

  const carePlanModel = genericModel(
    { get: () => carePlans, set: (r) => (carePlans = r) },
    { description: null, active: true }
  );

  function withCareSubscriptionExtras(row: Row) {
    return {
      ...row,
      carePlan: carePlans.find((p) => p.id === row.carePlanId) ?? null,
      vehicle: row.vehicleId ? (vehicles.find((v) => v.id === row.vehicleId) ?? null) : null,
    };
  }

  const careSubscriptionModel = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        status: "ACTIVE",
        startedAt: new Date(),
        endedAt: null,
        vehicleId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      } as Row;
      careSubscriptions.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = careSubscriptions.find((r) => r.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return withCareSubscriptionExtras(row);
    },
    async findUnique({ where }: { where: Record<string, unknown> }) {
      const row = careSubscriptions.find((r) => matches(r, where));
      return row ? withCareSubscriptionExtras(row) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(careSubscriptions.filter((r) => matches(r, where)), orderBy);
      return rows.map(withCareSubscriptionExtras);
    },
    async count({ where }: { where: Record<string, unknown> }) {
      return careSubscriptions.filter((r) => matches(r, where)).length;
    },
  };

  const customerInteractionModel = genericModel(
    { get: () => customerInteractions, set: (r) => (customerInteractions = r) },
    { subject: null, content: null }
  );

  const followUpModel = genericModel(
    { get: () => followUps, set: (r) => (followUps = r) },
    { status: "PENDING", notes: null, assignedToId: null, completedAt: null, cancelledAt: null }
  );

  const referralModel = genericModel({ get: () => referrals, set: (r) => (referrals = r) }, { status: "PENDING" });

  const fakeDb = {
    vehicle: vehicleModel,
    customer: customerModel,
    serviceRequest: serviceRequestModel,
    requestLocation: requestLocationModel,
    appointment: appointmentModel,
    appointmentLocation: appointmentLocationModel,
    auditLog: auditLogModel,
    technician: technicianModel,
    technicianAssignment: technicianAssignmentModel,
    diagnostic: diagnosticModel,
    diagnosticCheck: diagnosticCheckModel,
    diagnosticFaultCode: diagnosticFaultCodeModel,
    diagnosticReport: diagnosticReportModel,
    reportPhoto: reportPhotoModel,
    quote: quoteModel,
    quoteVersion: quoteVersionModel,
    quoteItem: quoteItemModel,
    workOrder: workOrderModel,
    workOrderItem: workOrderItemModel,
    workOrderPart: workOrderPartModel,
    workOrderPhoto: workOrderPhotoModel,
    workshopTransfer: workshopTransferModel,
    maintenancePlan: maintenancePlanModel,
    maintenanceReminder: maintenanceReminderModel,
    mileageReading: mileageReadingModel,
    invoice: invoiceModel,
    invoiceItem: invoiceItemModel,
    payment: paymentModel,
    campaign: campaignModel,
    carePlan: carePlanModel,
    careSubscription: careSubscriptionModel,
    customerInteraction: customerInteractionModel,
    followUp: followUpModel,
    referral: referralModel,
    async $transaction(fnOrArray: unknown) {
      if (typeof fnOrArray === "function") {
        return (fnOrArray as (tx: typeof fakeDb) => unknown)(fakeDb);
      }
      return Promise.all(fnOrArray as Promise<unknown>[]);
    },
    // Aides réservées aux tests.
    _seedVehicle(row: {
      id: string;
      customerId: string;
      status?: string;
      make?: string;
      model?: string;
      licensePlate?: string;
    }) {
      vehicles.push({ status: "ACTIVE", ...row } as Row);
    },
    // user optionnel, stocké tel quel sur la ligne (même principe que
    // _seedTechnician ci-dessous) — permet aux tests Phase 10 (Customer
    // 360, annuaire CRM) d'exercer customer.user.firstName/phoneE164 sans
    // reproduire un vrai `include` Prisma dans ce fake db.
    _seedCustomer(row: {
      id: string;
      userId: string;
      customerType?: string;
      whatsappOptIn?: boolean;
      emailOptIn?: boolean;
      smsOptIn?: boolean;
      marketingOptIn?: boolean;
      user?: { firstName: string; lastName: string; phoneE164: string; email?: string | null; createdAt?: Date };
    }) {
      customers.push({
        customerType: "INDIVIDUAL",
        whatsappOptIn: false,
        emailOptIn: false,
        smsOptIn: false,
        marketingOptIn: false,
        consentGivenAt: null,
        consentSource: null,
        consentRevokedAt: null,
        createdAt: new Date(),
        ...row,
      } as Row);
    },
    _seedTechnician(row: { id: string; user: { firstName: string; lastName: string } }) {
      technicians.push({ skills: [], isAvailable: true, ...row } as Row);
    },
    _serviceRequests: serviceRequests,
    _appointments: appointments,
    _technicianAssignments: technicianAssignments,
    _diagnostics: diagnostics,
    _quotes: quotes,
    _reset() {
      vehicles = [];
      customers = [];
      serviceRequests = [];
      requestLocations = [];
      appointments = [];
      appointmentLocations = [];
      auditLogs = [];
      technicians = [];
      technicianAssignments = [];
      diagnostics = [];
      diagnosticChecks = [];
      diagnosticFaultCodes = [];
      diagnosticReports = [];
      reportPhotos = [];
      quotes = [];
      quoteVersions = [];
      quoteItems = [];
      workOrders = [];
      workOrderItems = [];
      workOrderParts = [];
      workOrderPhotos = [];
      workshopTransfers = [];
      maintenancePlans = [];
      maintenanceReminders = [];
      mileageReadings = [];
      invoices = [];
      invoiceItems = [];
      payments = [];
      campaigns = [];
      carePlans = [];
      careSubscriptions = [];
      customerInteractions = [];
      followUps = [];
      referrals = [];
      nextSrSequence = 1;
      nextReportSequence = 1;
      nextQuoteSequence = 1;
      nextWorkOrderSequence = 1;
      nextInvoiceSequence = 1;
      nextPaymentSequence = 1;
      fakeDb._serviceRequests = serviceRequests;
      fakeDb._appointments = appointments;
      fakeDb._technicianAssignments = technicianAssignments;
      fakeDb._diagnostics = diagnostics;
      fakeDb._quotes = quotes;
    },
  };

  return fakeDb;
}
