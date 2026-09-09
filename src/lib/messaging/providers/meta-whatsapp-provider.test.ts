import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetaWhatsAppProvider } from "./meta-whatsapp-provider";

const ACCESS_TOKEN = "TEST_SECRET_TOKEN_ABC123";
const PHONE_NUMBER_ID = "123456789";

function mockFetchResponse(response: { ok: boolean; status?: number; json: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.json,
  });
}

describe("MetaWhatsAppProvider", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("sendTemplate() construit correctement la requête Graph API", async () => {
    const fetchMock = mockFetchResponse({ ok: true, json: { messages: [{ id: "wamid.123" }] } });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    await provider.sendTemplate("+22370000000", "otp_verification", { code: "123456" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`);
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "22370000000",
      type: "template",
      template: {
        name: "otp_verification",
        language: { code: "fr" },
        components: [{ type: "body", parameters: [{ type: "text", text: "123456" }] }],
      },
    });
  });

  it("configure l'en-tête Authorization avec le bearer token", async () => {
    const fetchMock = mockFetchResponse({ ok: true, json: { messages: [{ id: "wamid.123" }] } });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    await provider.sendText("+22370000000", "test");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it("utilise le Phone Number ID dans l'URL Graph API", async () => {
    const fetchMock = mockFetchResponse({ ok: true, json: { messages: [{ id: "wamid.123" }] } });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, "999888777");
    await provider.sendText("+22370000000", "test");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/999888777/messages");
  });

  it("normalise le numéro au format attendu par Graph API (E.164 sans '+')", async () => {
    const fetchMock = mockFetchResponse({ ok: true, json: { messages: [{ id: "wamid.123" }] } });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    await provider.sendText("+22360052626", "test");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string).to).toBe("22360052626");
  });

  it("une réponse Meta 2xx est un succès", async () => {
    const fetchMock = mockFetchResponse({ ok: true, json: { messages: [{ id: "wamid.abc" }] } });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    const result = await provider.sendText("+22370000000", "test");

    expect(result).toEqual({ success: true, providerMessageId: "wamid.abc" });
  });

  it("une réponse d'erreur Meta est un échec contrôlé (pas une exception)", async () => {
    const fetchMock = mockFetchResponse({
      ok: false,
      status: 400,
      json: { error: { message: "Invalid parameter" } },
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    const result = await provider.sendText("+22370000000", "test");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid parameter");
  });

  it("une erreur réseau est un échec contrôlé (pas une exception qui remonte)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    const result = await provider.sendText("+22370000000", "test");

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("n'expose jamais le token d'accès dans les logs, y compris en cas d'échec", async () => {
    const fetchMock = mockFetchResponse({ ok: false, status: 401, json: { error: { message: "Unauthorized" } } });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new MetaWhatsAppProvider(ACCESS_TOKEN, PHONE_NUMBER_ID);
    await provider.sendText("+22370000000", "test");
    await provider.sendTemplate("+22370000000", "otp_verification", { code: "654321" });

    const loggedText = [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]
      .flat()
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join("\n");
    expect(loggedText).not.toContain(ACCESS_TOKEN);
  });
});
