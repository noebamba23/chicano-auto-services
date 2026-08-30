import { beforeEach, describe, expect, it } from "vitest";
import type { createFakeDb } from "@/lib/service-requests/test-utils/fake-db";
import { vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/service-requests/test-utils/fake-db");
  return { db: createFakeDb() };
});

const { db } = await import("@/lib/db");
const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;

const { recordMileageReading, recordMileageReadingForCustomer, listMileageReadings, MileageRegressionError } =
  await import("./mileage");
const { VehicleNotFoundError } = await import("./service");

const CUSTOMER_A = "customer-a";
const VEHICLE_A = "vehicle-a";

beforeEach(() => {
  fakeDb._reset();
  fakeDb._seedCustomer({ id: CUSTOMER_A, userId: "user-a" });
  fakeDb._seedVehicle({ id: VEHICLE_A, customerId: CUSTOMER_A, mileage: 100_000 } as never);
});

describe("recordMileageReading", () => {
  it("enregistre un relevé et met à jour Vehicle.mileage", async () => {
    const reading = await recordMileageReading(VEHICLE_A, { value: 100_500, source: "TECHNICIAN" });
    expect(reading.value).toBe(100_500);

    const vehicle = (await fakeDb.vehicle.findUnique({ where: { id: VEHICLE_A } })) as Record<string, unknown>;
    expect(vehicle.mileage).toBe(100_500);
  });

  it("conserve l'historique (plusieurs relevés successifs)", async () => {
    await recordMileageReading(VEHICLE_A, { value: 100_500, source: "TECHNICIAN" });
    await recordMileageReading(VEHICLE_A, { value: 101_200, source: "TECHNICIAN" });

    const readings = await listMileageReadings(VEHICLE_A);
    expect(readings).toHaveLength(2);
  });

  it("refuse une valeur inférieure sans confirmation (anti-régression)", async () => {
    await expect(recordMileageReading(VEHICLE_A, { value: 99_000, source: "TECHNICIAN" })).rejects.toThrow(
      MileageRegressionError
    );

    const vehicle = (await fakeDb.vehicle.findUnique({ where: { id: VEHICLE_A } })) as Record<string, unknown>;
    expect(vehicle.mileage).toBe(100_000);
  });

  it("accepte une valeur inférieure si explicitement confirmée (correction production/technicien)", async () => {
    const reading = await recordMileageReading(VEHICLE_A, { value: 99_000, source: "TECHNICIAN", confirmed: true });
    expect(reading.value).toBe(99_000);
  });

  it("refuse pour un véhicule inexistant", async () => {
    await expect(recordMileageReading("unknown", { value: 1000, source: "TECHNICIAN" })).rejects.toThrow(
      VehicleNotFoundError
    );
  });
});

describe("recordMileageReadingForCustomer", () => {
  it("un client ne peut jamais forcer une régression (pas de confirmation exposée)", async () => {
    await expect(recordMileageReadingForCustomer(CUSTOMER_A, VEHICLE_A, 99_000)).rejects.toThrow(MileageRegressionError);
  });

  it("un client ne peut pas modifier le kilométrage du véhicule d'un autre client", async () => {
    await expect(recordMileageReadingForCustomer("other-customer", VEHICLE_A, 100_500)).rejects.toThrow(
      VehicleNotFoundError
    );
  });
});
