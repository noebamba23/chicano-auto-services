import { beforeEach, describe, expect, it, vi } from "vitest";

const whatsappVerificationCreateMock = vi.fn();
const whatsappVerificationFindFirstMock = vi.fn();
const whatsappVerificationCountMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    whatsappVerification: {
      create: (...args: unknown[]) => whatsappVerificationCreateMock(...args),
      findFirst: (...args: unknown[]) => whatsappVerificationFindFirstMock(...args),
      count: (...args: unknown[]) => whatsappVerificationCountMock(...args),
    },
  },
}));

const sendTextMock = vi.fn();
const sendTemplateMock = vi.fn();
const getWhatsAppProviderMock = vi.fn();
const isMockWhatsAppActiveMock = vi.fn();

vi.mock("./get-provider", () => ({
  getWhatsAppProvider: () => getWhatsAppProviderMock(),
  isMockWhatsAppActive: () => isMockWhatsAppActiveMock(),
}));

const { WhatsAppVerificationService, WhatsAppVerificationError } = await import(
  "./whatsapp-verification-service"
);

beforeEach(() => {
  vi.clearAllMocks();
  whatsappVerificationFindFirstMock.mockResolvedValue(null); // pas de cooldown en attente
  whatsappVerificationCreateMock.mockResolvedValue({ id: "v1" });
  whatsappVerificationCountMock.mockResolvedValue(0);
  delete process.env.WHATSAPP_META_OTP_TEMPLATE_NAME;
});

describe("WhatsAppVerificationService — envoi du code OTP", () => {
  it("mode mock : envoie l'OTP via sendText() (comportement inchangé)", async () => {
    isMockWhatsAppActiveMock.mockReturnValue(true);
    sendTextMock.mockResolvedValue({ success: true, providerMessageId: "mock-1" });
    getWhatsAppProviderMock.mockReturnValue({ name: "whatsapp-mock", sendText: sendTextMock });

    await WhatsAppVerificationService.sendVerificationCode("u1", "+22370000000");

    expect(sendTextMock).toHaveBeenCalledTimes(1);
    expect(sendTextMock.mock.calls[0][0]).toBe("+22370000000");
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("mode meta : envoie l'OTP via sendTemplate() avec un paramètre positionnel 'code'", async () => {
    process.env.WHATSAPP_META_OTP_TEMPLATE_NAME = "otp_verification";
    isMockWhatsAppActiveMock.mockReturnValue(false);
    sendTemplateMock.mockResolvedValue({ success: true, providerMessageId: "wamid-1" });
    getWhatsAppProviderMock.mockReturnValue({
      name: "whatsapp-meta",
      sendText: sendTextMock,
      sendTemplate: sendTemplateMock,
    });

    await WhatsAppVerificationService.sendVerificationCode("u1", "+22370000000");

    expect(sendTemplateMock).toHaveBeenCalledTimes(1);
    const [to, templateName, params] = sendTemplateMock.mock.calls[0];
    expect(to).toBe("+22370000000");
    expect(templateName).toBe("otp_verification");
    expect(Object.keys(params)).toEqual(["code"]);
    expect(typeof params.code).toBe("string");
    expect(sendTextMock).not.toHaveBeenCalled();
  });

  it("mode meta sans WHATSAPP_META_OTP_TEMPLATE_NAME : échec explicite, jamais de repli silencieux vers sendText()", async () => {
    isMockWhatsAppActiveMock.mockReturnValue(false);
    getWhatsAppProviderMock.mockReturnValue({
      name: "whatsapp-meta",
      sendText: sendTextMock,
      sendTemplate: sendTemplateMock,
    });

    await expect(
      WhatsAppVerificationService.sendVerificationCode("u1", "+22370000000")
    ).rejects.toThrow(WhatsAppVerificationError);

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });
});
