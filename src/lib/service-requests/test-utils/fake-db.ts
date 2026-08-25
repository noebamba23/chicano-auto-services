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

  const fakeDb = {
    vehicle: vehicleModel,
    customer: customerModel,
    serviceRequest: serviceRequestModel,
    requestLocation: requestLocationModel,
    appointment: appointmentModel,
    appointmentLocation: appointmentLocationModel,
    auditLog: auditLogModel,
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
    _serviceRequests: serviceRequests,
    _appointments: appointments,
    _reset() {
      vehicles = [];
      customers = [];
      serviceRequests = [];
      requestLocations = [];
      appointments = [];
      appointmentLocations = [];
      auditLogs = [];
      nextSrSequence = 1;
      fakeDb._serviceRequests = serviceRequests;
      fakeDb._appointments = appointments;
    },
  };

  return fakeDb;
}
