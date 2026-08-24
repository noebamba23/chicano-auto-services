import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const getCustomerIdForUserMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }));
vi.mock("./service", () => ({ getCustomerIdForUser: getCustomerIdForUserMock }));

const { requireVerifiedCustomer, UnauthenticatedError, UnverifiedAccountError } = await import("./guard");

beforeEach(() => {
  getSessionMock.mockReset();
  getCustomerIdForUserMock.mockReset();
});

describe("requireVerifiedCustomer", () => {
  it("rejette un utilisateur non authentifié (pas de session)", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireVerifiedCustomer()).rejects.toThrow(UnauthenticatedError);
  });

  it("rejette un compte suspendu", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "SUSPENDED", role: "CUSTOMER" });
    await expect(requireVerifiedCustomer()).rejects.toThrow(UnauthenticatedError);
  });

  it("rejette un compte non vérifié WhatsApp (PENDING_VERIFICATION)", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "PENDING_VERIFICATION", role: "CUSTOMER" });
    await expect(requireVerifiedCustomer()).rejects.toThrow(UnverifiedAccountError);
  });

  it("résout le customerId pour un compte vérifié", async () => {
    getSessionMock.mockResolvedValue({ sub: "u1", status: "VERIFIED", role: "CUSTOMER" });
    getCustomerIdForUserMock.mockResolvedValue("customer-1");

    const result = await requireVerifiedCustomer();
    expect(result.customerId).toBe("customer-1");
    expect(result.session.sub).toBe("u1");
  });
});
