// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes";
import {
  fetchSearchMovie,
  isRetryableFetchError,
  SEARCH_MOVIE_TOTAL_ATTEMPTS,
} from "../fetchSearchMovie";
import { jsonResponse } from "./jsonResponse";

describe("fetchSearchMovie", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("succeeds on first attempt", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ title: "Gozu" }));

    const response = await fetchSearchMovie({ title: "Gozu", year: "2003", country: "es_AR" });

    expect(response.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      HTTP_API_PATHS.searchMovie,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Gozu", year: "2003", country: "es_AR" }),
      }),
    );
  });

  it("retries on Failed to fetch then succeeds", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ title: "Gozu" }));

    const pending = fetchSearchMovie({ title: "Gozu", year: "2003", country: "es_AR" });
    await vi.advanceTimersByTimeAsync(500);
    const response = await pending;

    expect(response.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries", async () => {
    vi.useFakeTimers();
    const networkError = new TypeError("Failed to fetch");
    globalThis.fetch = vi.fn().mockRejectedValue(networkError);

    const pending = fetchSearchMovie({ title: "Gozu", year: "2003", country: "es_AR" });
    const expectation = expect(pending).rejects.toBe(networkError);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1500);
    await expectation;
    expect(globalThis.fetch).toHaveBeenCalledTimes(SEARCH_MOVIE_TOTAL_ATTEMPTS);
  });

  it("does not retry on HTTP 5xx responses", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "upstream" }, { status: 500 }));

    const response = await fetchSearchMovie({ title: "Gozu", year: "2003", country: "es_AR" });

    expect(response.status).toBe(500);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes an abort signal to fetch", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ title: "Gozu" }));

    await fetchSearchMovie({ title: "Gozu", year: "2003", country: "es_AR" });

    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeDefined();
  });
});

describe("isRetryableFetchError", () => {
  it("returns true for Failed to fetch TypeError", () => {
    expect(isRetryableFetchError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true for TimeoutError", () => {
    expect(isRetryableFetchError(new DOMException("Timed out", "TimeoutError"))).toBe(true);
  });

  it("returns false for generic errors", () => {
    expect(isRetryableFetchError(new Error("boom"))).toBe(false);
  });

  it("returns false for AbortError", () => {
    expect(isRetryableFetchError(new DOMException("Aborted", "AbortError"))).toBe(false);
  });
});
