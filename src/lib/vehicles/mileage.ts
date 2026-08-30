import { db } from "@/lib/db";
import { getVehicleForCustomer, VehicleNotFoundError } from "./service";
import type { MileageSource } from "@prisma/client";

// Kilométrage (Phase 8) — MileageReading était posé en Phase 2, jamais
// exploité (confirmé vide sur Neon avant cette phase). Vehicle.mileage reste
// le relevé courant (dénormalisé pour affichage rapide), MileageReading
// conserve l'historique complet — jamais de valeur silencieusement écrasée.

export class MileageRegressionError extends Error {
  constructor(current: number, attempted: number) {
    super(
      `Le kilométrage saisi (${attempted} km) est inférieur au dernier relevé connu (${current} km). Confirmation requise.`
    );
    this.name = "MileageRegressionError";
  }
}

export function listMileageReadings(vehicleId: string) {
  return db.mileageReading.findMany({
    where: { vehicleId },
    orderBy: { recordedAt: "desc" },
  });
}

// confirmed=true autorise explicitement une valeur inférieure (ex.
// correction d'une erreur de saisie par la production) — jamais implicite,
// toujours audité avec l'ancienne et la nouvelle valeur (section "HISTORIQUE
// IMMUTABLE").
export async function recordMileageReading(
  vehicleId: string,
  input: { value: number; source: MileageSource; notes?: string; confirmed?: boolean }
) {
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, mileage: true } });
  if (!vehicle) throw new VehicleNotFoundError();

  if (vehicle.mileage !== null && input.value < vehicle.mileage && !input.confirmed) {
    throw new MileageRegressionError(vehicle.mileage, input.value);
  }

  const [reading] = await db.$transaction([
    db.mileageReading.create({
      data: { vehicleId, value: input.value, source: input.source, notes: input.notes || null },
    }),
    db.vehicle.update({ where: { id: vehicleId }, data: { mileage: input.value } }),
    db.auditLog.create({
      data: {
        action: "MILEAGE_RECORDED",
        entity: "Vehicle",
        entityId: vehicleId,
        oldValue: { mileage: vehicle.mileage },
        newValue: { mileage: input.value, source: input.source },
      },
    }),
  ]);

  return reading;
}

// Espace client — un client peut enregistrer un relevé mais ne peut JAMAIS
// forcer une régression (pas de champ "confirmed" exposé côté client),
// contrairement à la production/au technicien (voir docs/MAINTENANCE.md).
export async function recordMileageReadingForCustomer(customerId: string, vehicleId: string, value: number) {
  await getVehicleForCustomer(customerId, vehicleId);
  return recordMileageReading(vehicleId, { value, source: "CUSTOMER" });
}
