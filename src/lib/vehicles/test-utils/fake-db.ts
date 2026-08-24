import { randomUUID } from "crypto";

// Fake Prisma minimal, écrit à la main, qui ne reproduit QUE le sous-ensemble
// d'API réellement utilisé par src/lib/vehicles/service.ts (count, create,
// update, updateMany, findFirst, findMany, $transaction, plus customer/
// vehiclePhoto/auditLog). Ce n'est pas un mock générique de Prisma — un test
// qui utiliserait une méthode non implémentée ici échouera bruyamment plutôt
// que silencieusement. Sert à tester la logique métier (ownership, unicité du
// véhicule principal, archivage) sans base de données réelle : voir
// docs/VEHICLES.md pour ce que ces tests couvrent et ne couvrent PAS
// (aucune garantie de comportement Postgres réel — contraintes, transactions,
// index, etc. — seule la logique applicative est exercée).

type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const key of Object.keys(where)) {
    const condition = where[key];
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
  let vehiclePhotos: Row[] = [];
  let auditLogs: Row[] = [];
  let customersByUserId: Record<string, string> = {};
  let nextSequence = 1;

  function withPhotos(row: Row) {
    return { ...row, photos: vehiclePhotos.filter((p) => p.vehicleId === row.id) };
  }

  const vehicle = {
    async count({ where }: { where: Record<string, unknown> }) {
      return vehicles.filter((v) => matches(v, where)).length;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = {
        id: randomUUID(),
        sequenceNumber: nextSequence++,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "ACTIVE",
        isPrimary: false,
        archivedAt: null,
        photos: [],
        ...data,
      };
      vehicles.push(row);
      return withPhotos(row);
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const row = vehicles.find((v) => v.id === where.id);
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data, { updatedAt: new Date() });
      return withPhotos(row);
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const rows = vehicles.filter((v) => matches(v, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
    async findFirst({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(
        vehicles.filter((v) => matches(v, where)),
        orderBy
      );
      return rows[0] ? withPhotos(rows[0]) : null;
    },
    async findMany({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) {
      const rows = applyOrder(
        vehicles.filter((v) => matches(v, where)),
        orderBy
      );
      return rows.map(withPhotos);
    },
  };

  const customer = {
    async findUnique({ where }: { where: { userId: string } }) {
      const id = customersByUserId[where.userId];
      return id ? { id } : null;
    },
  };

  const vehiclePhoto = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), createdAt: new Date(), caption: null, ...data } as Row;
      vehiclePhotos.push(row);
      return row;
    },
  };

  const auditLog = {
    async create({ data }: { data: Record<string, unknown> }) {
      const row: Row = { id: randomUUID(), createdAt: new Date(), ...data } as Row;
      auditLogs.push(row);
      return row;
    },
  };

  const fakeDb = {
    vehicle,
    customer,
    vehiclePhoto,
    auditLog,
    async $transaction(fnOrArray: unknown) {
      if (typeof fnOrArray === "function") {
        return (fnOrArray as (tx: typeof fakeDb) => unknown)(fakeDb);
      }
      return Promise.all(fnOrArray as Promise<unknown>[]);
    },
    // Aides réservées aux tests — n'existent pas sur un vrai PrismaClient.
    _seedCustomer(userId: string, customerId: string) {
      customersByUserId[userId] = customerId;
    },
    _vehicles: vehicles,
    _auditLogs: auditLogs,
    _reset() {
      vehicles = [];
      vehiclePhotos = [];
      auditLogs = [];
      customersByUserId = {};
      nextSequence = 1;
      fakeDb._vehicles = vehicles;
      fakeDb._auditLogs = auditLogs;
    },
  };

  return fakeDb;
}
