import { describe, it, expect, beforeEach, vi } from "vitest";
import { captureServerException } from "@server/lib/sentryCapture.js";

const sentryMocks = vi.hoisted(() => ({
  getClient: vi.fn(() => null),
  captureException: vi.fn(() => "evt-1"),
}));

vi.mock("@sentry/node", () => ({
  getClient: () => sentryMocks.getClient(),
  captureException: (...a: unknown[]) => sentryMocks.captureException(...(a as [])),
}));

describe("captureServerException", () => {
  beforeEach(() => {
    sentryMocks.getClient.mockReturnValue(null);
    sentryMocks.captureException.mockClear();
  });

  it("returns empty string when Sentry is disabled", () => {
    expect(captureServerException(new Error("x"), { route: "search-movie" })).toBe("");
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("captures with route tag and extra when client exists", () => {
    sentryMocks.getClient.mockReturnValue({} as never);
    const id = captureServerException(new Error("boom"), {
      route: "search-movie",
      extra: { title: "Inception" },
      tags: { layer: "api" },
    });
    expect(id).toBe("evt-1");
    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { route: "search-movie", layer: "api" },
        extra: { title: "Inception" },
      }),
    );
  });
});
