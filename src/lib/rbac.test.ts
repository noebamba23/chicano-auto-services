import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }));

const { requireProductionRole, ForbiddenRoleError } = await import("./rbac");
const { UnauthenticatedError } = await import("./vehicles/guard");

beforeEach(() => {
  getSessionMock.mockReset();
});

describe("requireProductionRole", () => {
  it("rejette un utilisateur non authentifié", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireProductionRole()).rejects.toThrow(UnauthenticatedError);
  });

  it("rejette un client (CUSTOMER) — accès production interdit", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "VERIFIED", role: "CUSTOMER" });
    await expect(requireProductionRole()).rejects.toThrow(ForbiddenRoleError);
  });

  it("rejette un technicien — pas un rôle production", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "VERIFIED", role: "TECHNICIAN" });
    await expect(requireProductionRole()).rejects.toThrow(ForbiddenRoleError);
  });

  it("autorise PRODUCTION_STAFF", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "VERIFIED", role: "PRODUCTION_STAFF" });
    await expect(requireProductionRole()).resolves.toBeDefined();
  });

  it("autorise SUPER_ADMIN", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "VERIFIED", role: "SUPER_ADMIN" });
    await expect(requireProductionRole()).resolves.toBeDefined();
  });
});
