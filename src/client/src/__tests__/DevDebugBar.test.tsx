// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { DevDebugBar } from "../DevDebugBar";
import { isViteDev } from "../devDebugBarEnv";

vi.mock("../devDebugBarEnv", () => ({
  isViteDev: vi.fn(),
}));

describe("DevDebugBar", () => {
  beforeEach(() => {
    document.body.classList.remove("has-dev-debug-bar");
    vi.mocked(isViteDev).mockReset();
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
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing and does not toggle body class when not in Vite dev mode", async () => {
    vi.mocked(isViteDev).mockReturnValue(false);

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
    document.body.removeChild(container);
  });

  it("renders the debug region and adds body class in Vite dev mode; cleans up on unmount", async () => {
    vi.mocked(isViteDev).mockReturnValue(true);

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
    expect(bar?.getAttribute("role")).toBe("region");
    expect(bar?.getAttribute("aria-label")).toBe("Development tools");
    expect(bar?.textContent).toContain(
      "Cache: watchlist 3, list 1, search idx 2 (~str 5, ~unidx 3)",
    );
    expect(
      bar?.querySelector('[data-testid="dev-cache-status"] .debug-bar__tip')?.textContent ?? "",
    ).toContain("Redis key prefix (FLY_APP_NAME): movie-justwatch");
    expect(bar?.textContent).toContain("Reset Redis cache");
    expect(bar?.textContent).toContain("Export Redis snapshot");
    expect(bar?.textContent).toContain("Clear list cache");
    expect(bar?.textContent).toContain("Load dummy watchlist");
    expect(bar?.textContent).not.toContain("Refresh Redis snapshot (dev)");
    expect(bar?.textContent).not.toContain("Validate Redis snapshot (dev)");
    expect(bar?.textContent).not.toContain("Seed Redis snapshot (dev)");
    expect(document.body.classList.contains("has-dev-debug-bar")).toBe(true);

    await act(async () => {
      root.unmount();
    });

    expect(document.body.classList.contains("has-dev-debug-bar")).toBe(false);
    document.body.removeChild(container);
  });
});
