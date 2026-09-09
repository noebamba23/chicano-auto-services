import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUniqueMock = vi.fn();
const notificationTemplateFindUniqueMock = vi.fn();
const notificationCreateMock = vi.fn();
const notificationUpdateMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => userFindUniqueMock(...args) },
    notificationTemplate: {
      findUnique: (...args: unknown[]) => notificationTemplateFindUniqueMock(...args),
    },
    notification: {
      create: (...args: unknown[]) => notificationCreateMock(...args),
      update: (...args: unknown[]) => notificationUpdateMock(...args),
    },
  },
}));

const sendTextMock = vi.fn();
const sendTemplateMock = vi.fn();
const getWhatsAppProviderMock = vi.fn();
const isMockWhatsAppActiveMock = vi.fn();

vi.mock("@/lib/messaging/get-provider", () => ({
  getWhatsAppProvider: () => getWhatsAppProviderMock(),
  isMockWhatsAppActive: () => isMockWhatsAppActiveMock(),
}));

// Un seul événement pilote mappé (REQUEST_RECEIVED) — APPOINTMENT_CONFIRMED
// reste volontairement absent pour exercer le chemin "pas encore de
// template Meta pour cet événement".
vi.mock("./meta-template-map", () => ({
  META_TEMPLATE_MAP: {
    REQUEST_RECEIVED: { templateName: "request_received_template", paramKeys: ["reference"] },
  },
}));

const { sendNotification } = await import("./service");

beforeEach(() => {
  vi.clearAllMocks();
  userFindUniqueMock.mockResolvedValue({ phoneE164: "+22370000000" });
  notificationTemplateFindUniqueMock.mockResolvedValue({
    isActive: true,
    channel: "WHATSAPP",
    bodyTemplate: "Votre demande {{reference}} a bien été reçue.",
  });
  notificationCreateMock.mockResolvedValue({ id: "n1" });
  notificationUpdateMock.mockResolvedValue({});
  getWhatsAppProviderMock.mockReturnValue({
    name: "whatsapp-meta",
    sendText: sendTextMock,
    sendTemplate: sendTemplateMock,
  });
});

describe("sendNotification — mode meta", () => {
  beforeEach(() => {
    isMockWhatsAppActiveMock.mockReturnValue(false);
  });

  it("utilise sendTemplate() quand un template Meta est configuré pour l'événement", async () => {
    sendTemplateMock.mockResolvedValue({ success: true, providerMessageId: "wamid-1" });

    const result = await sendNotification("u1", "REQUEST_RECEIVED", { reference: "REQ-001" });

    expect(sendTemplateMock).toHaveBeenCalledWith("+22370000000", "request_received_template", {
      reference: "REQ-001",
    });
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(true);
    expect(notificationUpdateMock).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });

  it("échec explicite et observable sans template Meta configuré — jamais de repli silencieux vers sendText()", async () => {
    const result = await sendNotification("u1", "APPOINTMENT_CONFIRMED", { reference: "REQ-002" });

    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.error).toContain("APPOINTMENT_CONFIRMED");
    expect(notificationUpdateMock).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "FAILED", sentAt: null },
    });
  });
});

describe("sendNotification — mode mock (régression)", () => {
  it("continue à envoyer via sendText() en mode mock, quel que soit l'événement", async () => {
    isMockWhatsAppActiveMock.mockReturnValue(true);
    sendTextMock.mockResolvedValue({ success: true, providerMessageId: "mock-1" });

    const result = await sendNotification("u1", "REQUEST_RECEIVED", { reference: "REQ-003" });

    expect(sendTextMock).toHaveBeenCalledTimes(1);
    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(true);
  });
});
