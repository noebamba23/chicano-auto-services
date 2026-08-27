import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { formatChicanoVehicleId } from "./vehicle-id";
import { normalizePlateNumber, parsePlateNumber, InvalidPlateFormatError } from "./registration/plate";
import type { VehicleInput } from "@/lib/validation/vehicles";
import type { Prisma, VehicleStatus } from "@prisma/client";

// Couche de service véhicules (section 7 de la Phase 2). Toute fonction ici
// prend un `customerId` déjà résolu depuis la session — jamais un id de
// véhicule transmis par le client sans vérification de propriété (section 6).
// Un véhicule qui n'appartient pas au client se comporte EXACTEMENT comme un
// véhicule inexistant (VehicleNotFoundError), pour ne jamais laisser fuiter
// son existence à un tiers.

export class VehicleNotFoundError extends Error {
  constructor() {
    super("Véhicule introuvable.");
    this.name = "VehicleNotFoundError";
  }
}

// Le véhicule existe et appartient bien à l'appelant, mais l'opération
// demandée est incompatible avec son état actuel (ex. définir un véhicule
// archivé comme principal). Distinct de VehicleNotFoundError : ce cas ne
// révèle rien qu'un propriétaire légitime ne sache déjà (409, pas 404).
export class VehicleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VehicleConflictError";
  }
}

// Chaque transaction ci-dessous fait 3-4 aller-retours réseau séquentiels
// (count/create/update/auditLog). Le timeout interactif par défaut de Prisma
// (5s) peut être dépassé par la latence réelle vers une base distante — bien
// en deçà de ce qu'exigerait un vrai problème de verrou. Ajuster ces valeurs
// n'change aucune logique métier.
const TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 10_000 };

const VEHICLE_INCLUDE = {
  photos: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.VehicleInclude;

export async function getCustomerIdForUser(userId: string): Promise<string | null> {
  const customer = await db.customer.findUnique({ where: { userId }, select: { id: true } });
  return customer?.id ?? null;
}

export function listVehiclesForCustomer(customerId: string, status: VehicleStatus = "ACTIVE") {
  return db.vehicle.findMany({
    where: { customerId, status },
    include: VEHICLE_INCLUDE,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

// Recherche production (section 12 de la demande "IMMATRICULATION MALI") —
// aucun filtre d'ownership, réservée aux routes déjà gardées par
// requireProductionRole(). Normalise TOUJOURS via normalizePlateNumber()
// avant de comparer, jamais de logique de normalisation dupliquée ici :
// "AB123CD", "AB 123 CD" et "ab123cd" doivent tous trouver le même véhicule.
export function findVehiclesByPlateForProduction(rawPlateQuery: string) {
  const normalized = normalizePlateNumber(rawPlateQuery);
  if (!normalized) return Promise.resolve([]);

  return db.vehicle.findMany({
    where: { licensePlate: { contains: normalized, mode: "insensitive" } },
    include: { ...VEHICLE_INCLUDE, customer: { include: { user: { select: { firstName: true, lastName: true, phoneE164: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVehicleForCustomer(customerId: string, vehicleId: string) {
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, customerId },
    include: VEHICLE_INCLUDE,
  });
  if (!vehicle) throw new VehicleNotFoundError();
  return vehicle;
}

// MVP simplifié (voir docs/VEHICLE-REGISTRATION-MALI.md) : seule la
// validation du format LL CCC LL est appliquée, aucune donnée territoriale.
// buildRegistrationFields() est le SEUL endroit qui parse/normalise
// plateInput — jamais dupliqué ailleurs (fonction unique, utilisée partout).
function buildRegistrationFields(plateInput: string) {
  const parsed = parsePlateNumber(plateInput);
  if (!parsed) throw new InvalidPlateFormatError();

  return {
    licensePlate: normalizePlateNumber(plateInput),
    plateDataStatus: "STRUCTURED" as const,
  };
}

function buildCreateData(input: VehicleInput) {
  const registration = buildRegistrationFields(input.plateInput);

  return {
    chicanoVehicleId: `pending-${randomUUID()}`,
    make: input.make,
    model: input.model,
    trim: input.trim || null,
    year: input.year ?? null,
    bodyType: input.bodyType ?? null,
    fuelType: input.fuelType,
    engine: input.engine || null,
    transmission: input.transmission ?? null,
    ...registration,
    vin: input.vin || null,
    mileage: input.mileage ?? null,
    color: input.color || null,
    firstRegisteredAt: input.firstRegisteredAt ? new Date(input.firstRegisteredAt) : null,
    notes: input.notes || null,
  };
}

// Ne porte dans l'objet de mise à jour que les champs réellement présents
// dans le payload partiel — un champ absent (undefined) ne touche pas la
// valeur existante en base ; un champ présent mais vide (chaîne vide) efface
// explicitement la valeur.
function buildUpdateData(input: Partial<VehicleInput>): Prisma.VehicleUncheckedUpdateInput {
  const data: Prisma.VehicleUncheckedUpdateInput = {};

  if (input.make !== undefined) data.make = input.make;
  if (input.model !== undefined) data.model = input.model;
  if (input.trim !== undefined) data.trim = input.trim || null;
  if (input.year !== undefined) data.year = input.year;
  if (input.bodyType !== undefined) data.bodyType = input.bodyType;
  if (input.fuelType !== undefined) data.fuelType = input.fuelType;
  if (input.engine !== undefined) data.engine = input.engine || null;
  if (input.transmission !== undefined) data.transmission = input.transmission;
  if (input.plateInput !== undefined) {
    Object.assign(data, buildRegistrationFields(input.plateInput));
  }
  if (input.vin !== undefined) data.vin = input.vin || null;
  if (input.mileage !== undefined) data.mileage = input.mileage;
  if (input.color !== undefined) data.color = input.color || null;
  if (input.firstRegisteredAt !== undefined) {
    data.firstRegisteredAt = input.firstRegisteredAt ? new Date(input.firstRegisteredAt) : null;
  }
  if (input.notes !== undefined) data.notes = input.notes || null;

  return data;
}

export async function createVehicle(customerId: string, input: VehicleInput) {
  const createData = buildCreateData(input);

  return db.$transaction(async (tx) => {
    const existingCount = await tx.vehicle.count({ where: { customerId, status: "ACTIVE" } });

    // Placeholder unique temporaire — remplacé juste après par l'identifiant
    // CHC-VH dérivé du compteur natif Postgres (sequenceNumber), garanti
    // atomique même sous création concurrente (section 3 de la Phase 2).
    const created = await tx.vehicle.create({
      data: {
        ...createData,
        customerId,
        isPrimary: existingCount === 0,
      },
    });

    const vehicle = await tx.vehicle.update({
      where: { id: created.id },
      data: { chicanoVehicleId: formatChicanoVehicleId(created.sequenceNumber) },
      include: VEHICLE_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        action: "VEHICLE_CREATED",
        entity: "Vehicle",
        entityId: vehicle.id,
        newValue: { chicanoVehicleId: vehicle.chicanoVehicleId, make: vehicle.make, model: vehicle.model },
      },
    });

    return vehicle;
  }, TRANSACTION_OPTIONS);
}

export async function updateVehicle(customerId: string, vehicleId: string, input: Partial<VehicleInput>) {
  const existing = await db.vehicle.findFirst({ where: { id: vehicleId, customerId } });
  if (!existing) throw new VehicleNotFoundError();

  const vehicle = await db.vehicle.update({
    where: { id: vehicleId },
    data: buildUpdateData(input),
    include: VEHICLE_INCLUDE,
  });

  await db.auditLog.create({
    data: { action: "VEHICLE_UPDATED", entity: "Vehicle", entityId: vehicle.id, newValue: input },
  });

  return vehicle;
}

export async function setPrimaryVehicle(customerId: string, vehicleId: string) {
  const existing = await db.vehicle.findFirst({ where: { id: vehicleId, customerId } });
  if (!existing) throw new VehicleNotFoundError();
  if (existing.status !== "ACTIVE") {
    throw new VehicleConflictError("Un véhicule archivé ne peut pas être défini comme principal.");
  }

  return db.$transaction(async (tx) => {
    await tx.vehicle.updateMany({
      where: { customerId, isPrimary: true, NOT: { id: vehicleId } },
      data: { isPrimary: false },
    });
    const vehicle = await tx.vehicle.update({
      where: { id: vehicleId },
      data: { isPrimary: true },
      include: VEHICLE_INCLUDE,
    });
    await tx.auditLog.create({
      data: { action: "VEHICLE_SET_PRIMARY", entity: "Vehicle", entityId: vehicle.id },
    });
    return vehicle;
  }, TRANSACTION_OPTIONS);
}

export async function archiveVehicle(customerId: string, vehicleId: string) {
  const existing = await db.vehicle.findFirst({ where: { id: vehicleId, customerId } });
  if (!existing) throw new VehicleNotFoundError();
  if (existing.status !== "ACTIVE") {
    throw new VehicleConflictError("Ce véhicule est déjà archivé.");
  }

  return db.$transaction(async (tx) => {
    const archived = await tx.vehicle.update({
      where: { id: vehicleId },
      data: { status: "ARCHIVED", archivedAt: new Date(), isPrimary: false },
    });

    // Si le véhicule archivé était le véhicule principal, promouvoir le
    // véhicule actif restant le plus ancien pour qu'un client actif ne se
    // retrouve jamais sans véhicule principal.
    if (existing.isPrimary) {
      const nextPrimary = await tx.vehicle.findFirst({
        where: { customerId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });
      if (nextPrimary) {
        await tx.vehicle.update({ where: { id: nextPrimary.id }, data: { isPrimary: true } });
      }
    }

    await tx.auditLog.create({
      data: { action: "VEHICLE_ARCHIVED", entity: "Vehicle", entityId: archived.id },
    });

    return archived;
  }, TRANSACTION_OPTIONS);
}

export async function addVehiclePhoto(
  customerId: string,
  vehicleId: string,
  photo: { url: string; storageKey: string }
) {
  const existing = await db.vehicle.findFirst({ where: { id: vehicleId, customerId } });
  if (!existing) throw new VehicleNotFoundError();

  return db.vehiclePhoto.create({
    data: { vehicleId, url: photo.url, storageKey: photo.storageKey },
  });
}
