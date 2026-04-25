// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { DevDebugBar } from "../DevDebugBar";
import { isDevDebugBarEnabled } from "../devDebugBarEnv";
import {
  defaultDevCacheStatusPayload,
  devDebugBarListClearStatusPayload,
} from "./devDebugBarTestFixtures";
import { mockFetchUrl, withMountedInBody } from "./reactRootTestUtils";

vi.mock("../devDebugBarEnv", () => ({
  isDevDebugBarEnabled: vi.fn(),
}));

function getDevDebugBar(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="dev-debug-bar"]');
}

function debugBarTipText(root: ParentNode | null, testId: string): string {
  return root?.querySelector(`[data-testid="${testId}"] .debug-bar__tip`)?.textContent ?? "";
}

async function clickClearListCacheWhenReady(container: HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(container.querySelector('[data-testid="dev-clear-list-cache"]')).toBeTruthy();
  });
  const clearBtn = container.querySelector(
    '[data-testid="dev-clear-list-cache"]',
  ) as HTMLButtonElement;
  await act(async () => {
    clearBtn.click();
  });
}

const devDebugBarTree = (
  <AppStateProvider>
    <DevDebugBar />
  </AppStateProvider>
);

describe("DevDebugBar", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.classList.remove("has-dev-debug-bar");
    vi.mocked(isDevDebugBarEnabled).mockReset();
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => defaultDevCacheStatusPayload,
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing and does not toggle body class when the debug bar is disabled", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(false);

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      expect(getDevDebugBar(container)).toBeNull();
      expect(document.body.classList.contains("has-dev-debug-bar")).toBe(false);
    });
  });

  it("renders the debug region and adds body class when enabled; cleans up on unmount", async () => {
    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      const bar = getDevDebugBar(container);
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
        expect(debugBarTipText(bar, "dev-justwatch-http-errors")).toContain(
          "Total non-success attempts: 0",
        );
      });
      await waitFor(() => {
        expect(debugBarTipText(bar, "dev-cache-status")).toContain(
          "Redis key prefix (FLY_APP_NAME): movie-justwatch",
        );
      });
      await waitFor(() => {
        expect(debugBarTipText(bar, "dev-cache-status")).not.toContain("CACHE_TTL");
      });
      await waitFor(() => {
        const ttlTip = debugBarTipText(bar, "dev-cache-ttl-countdown");
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
    });

    expect(document.body.classList.contains("has-dev-debug-bar")).toBe(false);
  });

  it("shows last /api/dev/cache-status snapshot from sessionStorage on first paint before fetch resolves", async () => {
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

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      const bar = getDevDebugBar(container);
      expect(bar?.textContent).toContain(
        "Cache: watchlist 99, list 0, search idx 0 (~str 0, ~unidx 0)",
      );
      expect(bar?.textContent).toContain("JW errs: 2");

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => defaultDevCacheStatusPayload,
        } as Response);
      });

      await waitFor(() => {
        expect(bar?.textContent).toContain(
          "Cache: watchlist 3, list 1, search idx 2 (~str 5, ~unidx 3)",
        );
      });
    });
  });

  it("shows cache-status server error details when the JSON payload reports failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Redis unavailable" }),
    } as Response);

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      await waitFor(() => {
        const bar = getDevDebugBar(container);
        expect(bar?.textContent).toContain("Cache: status unavailable");
        expect(debugBarTipText(bar, "dev-cache-status")).toContain(
          "Server error: Redis unavailable",
        );
      });
    });
  });

  it("shows network error copy when cache-status fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      await waitFor(() => {
        const bar = getDevDebugBar(container);
        expect(debugBarTipText(bar, "dev-cache-status")).toContain(
          "Network error while calling /api/dev/cache-status",
        );
      });
    });
  });

  it("TTL tooltip reflects CACHE_TTL env when the snapshot includes it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ...defaultDevCacheStatusPayload,
        watchlistCacheEntries: 0,
        listCacheEntries: 0,
        searchMovieCacheEntries: 0,
        searchMovieApproxStringKeys: 0,
        searchMovieScannedStringKeys: 10,
        searchMovieUnindexedApprox: 0,
        cacheTtlEnvSeconds: 900,
        soonestIndexedKeyExpiryAtMs: Date.now() + 60_000,
      }),
    } as Response);

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      await waitFor(() => {
        const bar = getDevDebugBar(container);
        const ttlTip = debugBarTipText(bar, "dev-cache-ttl-countdown");
        expect(ttlTip).toContain("900");
        expect(ttlTip).toContain("CACHE_TTL env on this server process");
      });
    });
  });

  it("alerts and refreshes after clear-list-cache succeeds", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});

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
          json: async () => devDebugBarListClearStatusPayload,
        } as Response);
      });

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      await clickClearListCacheWhenReady(container);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Cleared 2 list cache entries.");
      });
      expect(
        fetchMock.mock.calls.some(([u]) => mockFetchUrl(u).includes("/clear-list-cache")),
      ).toBe(true);
    });

    alertSpy.mockRestore();
  });

  it("shows failed cache pill when clear-list-cache responds with an error", async () => {
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});

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
        json: async () => devDebugBarListClearStatusPayload,
      } as Response);
    });

    await withMountedInBody(devDebugBarTree, async ({ container }) => {
      await clickClearListCacheWhenReady(container);

      await waitFor(() => {
        expect(getDevDebugBar(container)?.textContent).toContain("Cache: failed");
      });
    });

    alertSpy.mockRestore();
  });
});
