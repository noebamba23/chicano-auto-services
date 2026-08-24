import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "./test-utils/fake-db";

// vi.mock est hoisté au-dessus des imports statiques ; l'import dynamique
// dans la factory évite le problème de "temporal dead zone" qu'on aurait en
// référençant directement un createFakeDb() importé statiquement (voir
// docs/VEHICLES.md, section tests, pour le détail de ce choix).
vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("./test-utils/fake-db");
  return { db: createFakeDb() };
});

const { db } = await import("@/lib/db");
const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;

const {
  createVehicle,
  getCustomerIdForUser,
  listVehiclesForCustomer,
  getVehicleForCustomer,
  updateVehicle,
  setPrimaryVehicle,
  archiveVehicle,
  VehicleNotFoundError,
  VehicleConflictError,
} = await import("./service");

const VALID_INPUT = {
  make: "Toyota",
  model: "Hilux",
  fuelType: "DIESEL" as const,
  licensePlate: "AB 1234 MD",
} as Parameters<typeof createVehicle>[1];

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";

beforeEach(() => {
  fakeDb._reset();
});

describe("createVehicle", () => {
  it("génère un CHC-VH-000001 et rend le 1er véhicule automatiquement principal", async () => {
    const vehicle = await createVehicle(CUSTOMER_A, VALID_INPUT);
    expect(vehicle.chicanoVehicleId).toBe("CHC-VH-000001");
    expect(vehicle.isPrimary).toBe(true);
    expect(vehicle.status).toBe("ACTIVE");
  });

  it("ne rend pas le 2e véhicule principal automatiquement", async () => {
    await createVehicle(CUSTOMER_A, VALID_INPUT);
    const second = await createVehicle(CUSTOMER_A, { ...VALID_INPUT, model: "Corolla" });
    expect(second.isPrimary).toBe(false);
    expect(second.chicanoVehicleId).toBe("CHC-VH-000002");
  });
});

describe("listVehiclesForCustomer", () => {
  it("ne retourne que les véhicules du client demandé", async () => {
    await createVehicle(CUSTOMER_A, VALID_INPUT);
    await createVehicle(CUSTOMER_B, { ...VALID_INPUT, model: "Corolla" });

    const vehiclesA = await listVehiclesForCustomer(CUSTOMER_A);
    expect(vehiclesA).toHaveLength(1);
    expect(vehiclesA[0].model).toBe("Hilux");
  });
});

describe("ownership — accès interdit à un véhicule d'un autre client", () => {
  it("getVehicleForCustomer lève VehicleNotFoundError pour un véhicule d'un autre client", async () => {
    const vehicle = await createVehicle(CUSTOMER_B, VALID_INPUT);
    await expect(getVehicleForCustomer(CUSTOMER_A, vehicle.id)).rejects.toThrow(VehicleNotFoundError);
  });

  it("updateVehicle lève VehicleNotFoundError pour un véhicule d'un autre client", async () => {
    const vehicle = await createVehicle(CUSTOMER_B, VALID_INPUT);
    await expect(updateVehicle(CUSTOMER_A, vehicle.id, { mileage: 1000 })).rejects.toThrow(
      VehicleNotFoundError
    );
  });

  it("setPrimaryVehicle lève VehicleNotFoundError pour un véhicule d'un autre client", async () => {
    const vehicle = await createVehicle(CUSTOMER_B, VALID_INPUT);
    await expect(setPrimaryVehicle(CUSTOMER_A, vehicle.id)).rejects.toThrow(VehicleNotFoundError);
  });

  it("archiveVehicle lève VehicleNotFoundError pour un véhicule d'un autre client", async () => {
    const vehicle = await createVehicle(CUSTOMER_B, VALID_INPUT);
    await expect(archiveVehicle(CUSTOMER_A, vehicle.id)).rejects.toThrow(VehicleNotFoundError);
  });

  it("lève VehicleNotFoundError pour un id inexistant", async () => {
    await expect(getVehicleForCustomer(CUSTOMER_A, "does-not-exist")).rejects.toThrow(VehicleNotFoundError);
  });
});

describe("updateVehicle", () => {
  it("ne modifie que les champs fournis", async () => {
    const vehicle = await createVehicle(CUSTOMER_A, VALID_INPUT);
    const updated = await updateVehicle(CUSTOMER_A, vehicle.id, { mileage: 42000 });
    expect(updated.mileage).toBe(42000);
    expect(updated.make).toBe("Toyota");
    expect(updated.model).toBe("Hilux");
  });
});

describe("véhicule principal", () => {
  it("un seul véhicule principal à la fois — la sélection d'un nouveau désélectionne l'ancien", async () => {
    const first = await createVehicle(CUSTOMER_A, VALID_INPUT);
    const second = await createVehicle(CUSTOMER_A, { ...VALID_INPUT, model: "Corolla" });

    expect(first.isPrimary).toBe(true);
    expect(second.isPrimary).toBe(false);

    await setPrimaryVehicle(CUSTOMER_A, second.id);

    const vehicles = await listVehiclesForCustomer(CUSTOMER_A);
    const primaryCount = vehicles.filter((v) => v.isPrimary).length;
    expect(primaryCount).toBe(1);
    expect(vehicles.find((v) => v.id === second.id)?.isPrimary).toBe(true);
    expect(vehicles.find((v) => v.id === first.id)?.isPrimary).toBe(false);
  });

  it("refuse de définir un véhicule archivé comme principal (409 conflit)", async () => {
    const vehicle = await createVehicle(CUSTOMER_A, VALID_INPUT);
    await archiveVehicle(CUSTOMER_A, vehicle.id);
    await expect(setPrimaryVehicle(CUSTOMER_A, vehicle.id)).rejects.toThrow(VehicleConflictError);
  });
});

describe("archivage", () => {
  it("archive sans supprimer et retire isPrimary", async () => {
    const vehicle = await createVehicle(CUSTOMER_A, VALID_INPUT);
    const archived = await archiveVehicle(CUSTOMER_A, vehicle.id);

    expect(archived.status).toBe("ARCHIVED");
    expect(archived.isPrimary).toBe(false);
    expect(archived.archivedAt).not.toBeNull();
    expect(fakeDb._vehicles.some((v) => v.id === vehicle.id)).toBe(true); // pas de suppression physique
  });

  it("n'apparaît plus dans la liste active après archivage", async () => {
    const vehicle = await createVehicle(CUSTOMER_A, VALID_INPUT);
    await archiveVehicle(CUSTOMER_A, vehicle.id);
    const active = await listVehiclesForCustomer(CUSTOMER_A);
    expect(active).toHaveLength(0);
  });

  it("promeut automatiquement un autre véhicule actif si le principal est archivé", async () => {
    const first = await createVehicle(CUSTOMER_A, VALID_INPUT);
    const second = await createVehicle(CUSTOMER_A, { ...VALID_INPUT, model: "Corolla" });
    expect(first.isPrimary).toBe(true);

    await archiveVehicle(CUSTOMER_A, first.id);

    const active = await listVehiclesForCustomer(CUSTOMER_A);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(second.id);
    expect(active[0].isPrimary).toBe(true);
  });

  it("refuse d'archiver un véhicule déjà archivé (409 conflit)", async () => {
    const vehicle = await createVehicle(CUSTOMER_A, VALID_INPUT);
    await archiveVehicle(CUSTOMER_A, vehicle.id);
    await expect(archiveVehicle(CUSTOMER_A, vehicle.id)).rejects.toThrow(VehicleConflictError);
  });
});

describe("getCustomerIdForUser", () => {
  it("retourne null si l'utilisateur n'a pas de profil client", async () => {
    const result = await getCustomerIdForUser("unknown-user");
    expect(result).toBeNull();
  });

  it("retourne l'id client résolu depuis l'utilisateur", async () => {
    fakeDb._seedCustomer("user-1", CUSTOMER_A);
    const result = await getCustomerIdForUser("user-1");
    expect(result).toBe(CUSTOMER_A);
  });
});
