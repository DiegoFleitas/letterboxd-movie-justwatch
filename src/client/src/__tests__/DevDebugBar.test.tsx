// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act, waitFor } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { DevDebugBar } from "../DevDebugBar";
import { isDevDebugBarEnabled } from "../devDebugBarEnv";

vi.mock("../devDebugBarEnv", () => ({
  isDevDebugBarEnabled: vi.fn(),
}));

function mockFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("DevDebugBar", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.classList.remove("has-dev-debug-bar");
    vi.mocked(isDevDebugBarEnabled).mockReset();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        redisKeyPrefix: "movie-justwatch",
        watchlistCacheEntries: 3,
        hasWatchlistCache: true,
        listCacheEntries: 1,
        hasListCache: true,
        searchMovieCacheEntries: 2,
        hasSearchMovieCache: true,
        searchMovieApproxStringKeys: 5,
        searchMovieScannedStringKeys: 120,
        searchMovieUnindexedApprox: 3,
        soonestIndexedKeyExpiryAtMs: null,
        justWatchHttpErrors: { total: 0, byStatus: {} },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing and does not toggle body class when the debug bar is disabled", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(false);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    expect(container.querySelector('[data-testid="dev-debug-bar"]')).toBeNull();
    expect(document.body.classList.contains("has-dev-debug-bar")).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the debug region and adds body class when enabled; cleans up on unmount", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    const bar = container.querySelector('[data-testid="dev-debug-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.tagName.toLowerCase()).toBe("section");
    expect(bar?.getAttribute("aria-label")).toBe("Development tools");

    await waitFor(() => {
      expect(bar?.textContent).toContain(
        "Cache: watchlist 3, list 1, search idx 2 (~str 5, ~unidx 3)",
      );
    });
    await waitFor(() => {
      expect(bar?.textContent).toContain("JW errs: 0");
    });
    await waitFor(() => {
      expect(bar?.textContent).toContain("Next key TTL");
    });
    await waitFor(() => {
      expect(
        bar?.querySelector('[data-testid="dev-justwatch-http-errors"] .debug-bar__tip')
          ?.textContent ?? "",
      ).toContain("Total non-success attempts: 0");
    });
    await waitFor(() => {
      expect(
        bar?.querySelector('[data-testid="dev-cache-status"] .debug-bar__tip')?.textContent ?? "",
      ).toContain("Redis key prefix (FLY_APP_NAME): movie-justwatch");
    });
    await waitFor(() => {
      const cacheTip =
        bar?.querySelector('[data-testid="dev-cache-status"] .debug-bar__tip')?.textContent ?? "";
      expect(cacheTip).not.toContain("CACHE_TTL");
    });
    await waitFor(() => {
      const ttlTip =
        bar?.querySelector('[data-testid="dev-cache-ttl-countdown"] .debug-bar__tip')
          ?.textContent ?? "";
      expect(ttlTip).toContain("CACHE_TTL");
      expect(ttlTip).toContain("3600s");
      expect(ttlTip).toContain("Letterboxd list/watchlist page cache: 20s");
    });
    expect(bar?.textContent).toContain("Reset Redis cache");
    expect(bar?.textContent).toContain("Export Redis snapshot");
    expect(bar?.textContent).toContain("Clear list cache");
    expect(bar?.textContent).toContain("Load dummy watchlist");
    expect(bar?.querySelector('[data-testid="dev-debug-origin"]')).not.toBeNull();
    expect(bar?.textContent).toContain("Origin:");
    expect(bar?.textContent).not.toContain("Refresh Redis snapshot (dev)");
    expect(bar?.textContent).not.toContain("Validate Redis snapshot (dev)");
    expect(bar?.textContent).not.toContain("Seed Redis snapshot (dev)");
    expect(document.body.classList.contains("has-dev-debug-bar")).toBe(true);

    await act(async () => {
      root.unmount();
    });

    expect(document.body.classList.contains("has-dev-debug-bar")).toBe(false);
    container.remove();
  });

  it("shows last /api/dev/cache-status snapshot from sessionStorage on first paint before fetch resolves", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);

    sessionStorage.setItem(
      "lbjw:dev-cache-status-payload-v1",
      JSON.stringify({
        ok: true,
        redisKeyPrefix: "movie-justwatch",
        watchlistCacheEntries: 99,
        listCacheEntries: 0,
        searchMovieCacheEntries: 0,
        searchMovieApproxStringKeys: 0,
        searchMovieUnindexedApprox: 0,
        justWatchHttpErrors: { total: 2, byStatus: { 503: 2 } },
      }),
    );

    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(() => fetchPromise);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    const bar = container.querySelector('[data-testid="dev-debug-bar"]');
    expect(bar?.textContent).toContain(
      "Cache: watchlist 99, list 0, search idx 0 (~str 0, ~unidx 0)",
    );
    expect(bar?.textContent).toContain("JW errs: 2");

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          ok: true,
          redisKeyPrefix: "movie-justwatch",
          watchlistCacheEntries: 3,
          hasWatchlistCache: true,
          listCacheEntries: 1,
          hasListCache: true,
          searchMovieCacheEntries: 2,
          hasSearchMovieCache: true,
          searchMovieApproxStringKeys: 5,
          searchMovieScannedStringKeys: 120,
          searchMovieUnindexedApprox: 3,
          soonestIndexedKeyExpiryAtMs: null,
          justWatchHttpErrors: { total: 0, byStatus: {} },
        }),
      } as Response);
    });

    await waitFor(() => {
      expect(bar?.textContent).toContain(
        "Cache: watchlist 3, list 1, search idx 2 (~str 5, ~unidx 3)",
      );
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows cache-status server error details when the JSON payload reports failure", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Redis unavailable" }),
    } as Response);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    await waitFor(() => {
      const bar = container.querySelector('[data-testid="dev-debug-bar"]');
      expect(bar?.textContent).toContain("Cache: status unavailable");
      expect(
        bar?.querySelector('[data-testid="dev-cache-status"] .debug-bar__tip')?.textContent ?? "",
      ).toContain("Server error: Redis unavailable");
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows network error copy when cache-status fetch throws", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    await waitFor(() => {
      const bar = container.querySelector('[data-testid="dev-debug-bar"]');
      const tip =
        bar?.querySelector('[data-testid="dev-cache-status"] .debug-bar__tip')?.textContent ?? "";
      expect(tip).toContain("Network error while calling /api/dev/cache-status");
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("TTL tooltip reflects CACHE_TTL env when the snapshot includes it", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        cacheTtlEnvSeconds: 900,
        redisKeyPrefix: "movie-justwatch",
        watchlistCacheEntries: 0,
        hasWatchlistCache: true,
        listCacheEntries: 0,
        hasListCache: true,
        searchMovieCacheEntries: 0,
        hasSearchMovieCache: true,
        searchMovieApproxStringKeys: 0,
        searchMovieScannedStringKeys: 10,
        searchMovieUnindexedApprox: 0,
        soonestIndexedKeyExpiryAtMs: Date.now() + 60_000,
        justWatchHttpErrors: { total: 0, byStatus: {} },
      }),
    } as Response);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    await waitFor(() => {
      const bar = container.querySelector('[data-testid="dev-debug-bar"]');
      const ttlTip =
        bar?.querySelector('[data-testid="dev-cache-ttl-countdown"] .debug-bar__tip')
          ?.textContent ?? "";
      expect(ttlTip).toContain("900");
      expect(ttlTip).toContain("CACHE_TTL env on this server process");
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("alerts and refreshes after clear-list-cache succeeds", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});

    const statusPayload = {
      ok: true,
      redisKeyPrefix: "movie-justwatch",
      watchlistCacheEntries: 1,
      hasWatchlistCache: true,
      listCacheEntries: 0,
      hasListCache: true,
      searchMovieCacheEntries: 0,
      hasSearchMovieCache: true,
      searchMovieApproxStringKeys: 0,
      searchMovieScannedStringKeys: 0,
      searchMovieUnindexedApprox: 0,
      soonestIndexedKeyExpiryAtMs: null,
      justWatchHttpErrors: { total: 0, byStatus: {} },
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input: RequestInfo | URL) => {
        const url = mockFetchUrl(input);
        if (url.includes("/clear-list-cache")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, cleared: 2 }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => statusPayload,
        } as Response);
      });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="dev-clear-list-cache"]')).toBeTruthy();
    });

    const clearBtn = container.querySelector(
      '[data-testid="dev-clear-list-cache"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clearBtn.click();
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Cleared 2 list cache entries.");
    });
    expect(fetchMock.mock.calls.some(([u]) => mockFetchUrl(u).includes("/clear-list-cache"))).toBe(
      true,
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
    alertSpy.mockRestore();
  });

  it("shows failed cache pill when clear-list-cache responds with an error", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});

    const statusPayload = {
      ok: true,
      redisKeyPrefix: "movie-justwatch",
      watchlistCacheEntries: 1,
      hasWatchlistCache: true,
      listCacheEntries: 0,
      hasListCache: true,
      searchMovieCacheEntries: 0,
      hasSearchMovieCache: true,
      searchMovieApproxStringKeys: 0,
      searchMovieScannedStringKeys: 0,
      searchMovieUnindexedApprox: 0,
      soonestIndexedKeyExpiryAtMs: null,
      justWatchHttpErrors: { total: 0, byStatus: {} },
    };

    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = mockFetchUrl(input);
      if (url.includes("/clear-list-cache")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ ok: false, error: "not allowed" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => statusPayload,
      } as Response);
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBar />
        </AppStateProvider>,
      );
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="dev-clear-list-cache"]')).toBeTruthy();
    });

    const clearBtn = container.querySelector(
      '[data-testid="dev-clear-list-cache"]',
    ) as HTMLButtonElement;
    await act(async () => {
      clearBtn.click();
    });

    await waitFor(() => {
      const bar = container.querySelector('[data-testid="dev-debug-bar"]');
      expect(bar?.textContent).toContain("Cache: failed");
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
    alertSpy.mockRestore();
  });
});
