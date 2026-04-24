// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act, waitFor } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { DevDebugBarGate } from "../DevDebugBarGate";
import { isDevDebugBarEnabled } from "../devDebugBarEnv";

vi.mock("../devDebugBarEnv", () => ({
  isDevDebugBarEnabled: vi.fn(),
}));

describe("DevDebugBarGate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.classList.remove("has-dev-debug-bar");
    vi.mocked(isDevDebugBarEnabled).mockReset();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        redisKeyPrefix: "movie-justwatch",
        watchlistCacheEntries: 0,
        hasWatchlistCache: false,
        listCacheEntries: 0,
        hasListCache: false,
        searchMovieCacheEntries: 0,
        hasSearchMovieCache: false,
        searchMovieApproxStringKeys: 0,
        searchMovieScannedStringKeys: 0,
        searchMovieUnindexedApprox: 0,
        soonestIndexedKeyExpiryAtMs: null,
        justWatchHttpErrors: { total: 0, byStatus: {} },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when the debug bar flag is disabled", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(false);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBarGate />
        </AppStateProvider>,
      );
    });

    expect(container.querySelector('[data-testid="dev-debug-bar"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("lazy-loads DevDebugBar when the flag is enabled", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <DevDebugBarGate />
        </AppStateProvider>,
      );
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="dev-debug-bar"]')).not.toBeNull();
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
