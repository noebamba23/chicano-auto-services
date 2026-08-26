import { randomUUID } from "crypto";

// Fake Prisma minimal dédié aux tests de src/lib/service-requests/service.ts
// et src/lib/appointments/service.ts — même principe et mêmes limites que
// src/lib/vehicles/test-utils/fake-db.ts (voir ce fichier pour le détail de
// ce qu'un tel fake couvre et ne couvre PAS). Fichier séparé plutôt que
// réutilisé/étendu pour ne prendre aucun risque sur les tests véhicules
// existants de la Phase 2 (consigne explicite : ne pas les casser).

type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown>): boolean {
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
  let nextSrSequence = 1;

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
      async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
        return applyOrder(store.get().filter((r) => matches(r, where)), orderBy);
      },
    };
  }

  const vehicleModel = {
    ...genericModel(
      { get: () => vehicles, set: (r) => (vehicles = r) },
      { status: "ACTIVE" }
    ),
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
    async $transaction(fnOrArray: unknown) {
      if (typeof fnOrArray === "function") {
        return (fnOrArray as (tx: typeof fakeDb) => unknown)(fakeDb);
      }
      return Promise.all(fnOrArray as Promise<unknown>[]);
    },
    // Aides réservées aux tests.
    _seedVehicle(row: { id: string; customerId: string; status?: string }) {
      vehicles.push({ status: "ACTIVE", ...row } as Row);
    },
    _seedCustomer(row: { id: string; userId: string }) {
      customers.push(row as Row);
    },
    _seedTechnician(row: { id: string; user: { firstName: string; lastName: string } }) {
      technicians.push({ skills: [], isAvailable: true, ...row } as Row);
    },
    _serviceRequests: serviceRequests,
    _appointments: appointments,
    _technicianAssignments: technicianAssignments,
    _diagnostics: diagnostics,
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
      nextSrSequence = 1;
      fakeDb._serviceRequests = serviceRequests;
      fakeDb._appointments = appointments;
      fakeDb._technicianAssignments = technicianAssignments;
      fakeDb._diagnostics = diagnostics;
    },
  };

  return fakeDb;
}
