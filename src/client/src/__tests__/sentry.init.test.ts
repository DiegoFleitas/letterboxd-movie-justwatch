// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const init = vi.fn();
const getClient = vi.fn(() => null);
const captureException = vi.fn(() => "evt");
const captureMessage = vi.fn(() => "msg");
const browserTracingIntegration = vi.fn(() => ({}));

vi.mock("@sentry/react", () => ({
  init,
  getClient,
  captureException,
  captureMessage,
  browserTracingIntegration,
}));

describe("frontend sentry helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    getClient.mockReset();
    captureException.mockClear();
    captureMessage.mockClear();
    getClient.mockReturnValue(null);
    delete (window as { __SENTRY_DSN__?: string }).__SENTRY_DSN__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initFrontendSentry is a no-op without DSN", async () => {
    const { initFrontendSentry } = await import("../sentry");
    initFrontendSentry();
    expect(init).not.toHaveBeenCalled();
  });

  it("initFrontendSentry calls Sentry.init when window DSN is set", async () => {
    (window as { __SENTRY_DSN__?: string }).__SENTRY_DSN__ = "https://k@sentry.io/1";
    const { initFrontendSentry } = await import("../sentry");
    initFrontendSentry();
    expect(init).toHaveBeenCalled();
    expect(init.mock.calls[0][0]).toMatchObject({ dsn: "https://k@sentry.io/1" });
  });

  it("captureFrontendException returns empty when no client", async () => {
    getClient.mockReturnValue(null);
    const { captureFrontendException } = await import("../sentry");
    expect(captureFrontendException(new Error("x"))).toBe("");
  });

  it("captureFrontendException forwards to Sentry when client exists", async () => {
    getClient.mockReturnValue({} as never);
    const { captureFrontendException } = await import("../sentry");
    const id = captureFrontendException(new Error("e"), { tags: { a: "b" } });
    expect(captureException).toHaveBeenCalled();
    expect(id).toBe("evt");
  });

  it("captureFrontendMessage returns empty when no client", async () => {
    getClient.mockReturnValue(null);
    const { captureFrontendMessage } = await import("../sentry");
    expect(captureFrontendMessage("m")).toBe("");
  });

  it("captureFrontendMessage uses Sentry when client exists", async () => {
    getClient.mockReturnValue({} as never);
    const { captureFrontendMessage } = await import("../sentry");
    expect(captureFrontendMessage("hello", { level: "warning" })).toBe("msg");
    expect(captureMessage).toHaveBeenCalledWith(
      "hello",
      expect.objectContaining({ level: "warning" }),
    );
  });
});
