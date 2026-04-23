// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { createInitialTabbedTileState, mergeTileStateForTab } from "../movieTiles";
import { AppStateProvider, selectActiveTileState, useAppState } from "../AppStateContext";
import { LeftPanel } from "../LeftPanel";
import { RightPanel } from "../RightPanel";

const COUNTRY_STORAGE_KEY = "letterboxd-justwatch-country";

describe("search panel tab isolation model", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("letterboxd-watchlist")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              watchlist: [
                {
                  title: "List Film",
                  year: "2020",
                  link: "https://letterboxd.com/film/list-film/",
                },
              ],
              lastPage: 1,
              totalPages: 1,
            }),
        } as Response);
      }
      if (url.includes("search-movie")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              title: "List Film",
              year: 2020,
              poster: "https://example.com/list.jpg",
              link: "https://letterboxd.com/film/list-film/",
              movieProviders: [],
            }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("selects only active-tab posters and preserves inactive tab", () => {
    let state = createInitialTabbedTileState();
    state = mergeTileStateForTab(state, "list", "List Film", "2020", {
      poster: "https://example.com/list.jpg",
      link: "https://letterboxd.com/film/list-film/",
    });
    state = mergeTileStateForTab(state, "movie", "Movie Film", "2021", {
      poster: "https://example.com/movie.jpg",
      link: "https://letterboxd.com/film/movie-film/",
    });

    const listState = selectActiveTileState(state, "list");
    const movieState = selectActiveTileState(state, "movie");

    expect(Object.keys(listState.movieTiles)).toEqual(["2020-LISTFILM"]);
    expect(Object.keys(movieState.movieTiles)).toEqual(["2021-MOVIEFILM"]);
    expect(listState.movieTiles["2020-LISTFILM"]?.poster).toBe("https://example.com/list.jpg");
    expect(movieState.movieTiles["2021-MOVIEFILM"]?.poster).toBe("https://example.com/movie.jpg");
  });

  it("does not render torrent search button in left panel", async () => {
    localStorage.setItem(COUNTRY_STORAGE_KEY, "en_US");
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <LeftPanel />
        </AppStateProvider>,
      );
    });

    expect(container.querySelector('[data-testid="alternative-search-btn"]')).toBeNull();
    expect(container.textContent?.includes("Torrent search")).toBe(false);

    localStorage.removeItem(COUNTRY_STORAGE_KEY);
  });

  it("hides alternative search icon when active tab is list", async () => {
    function Setup(): React.ReactElement {
      const { setShowAltSearchButton, setActiveTab } = useAppState();
      const [phase, setPhase] = React.useState<0 | 1>(0);
      React.useEffect(() => {
        if (phase === 0) {
          setShowAltSearchButton(true);
          setPhase(1);
          return;
        }
        setActiveTab("list");
      }, [phase, setActiveTab, setShowAltSearchButton]);
      return <RightPanel />;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <Setup />
        </AppStateProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('img[alt="Alternative search"]')).toBeNull();
  });

  it("shows alternative search icon on list after a list search", async () => {
    let resolveListLoadComplete: (() => void) | null = null;
    const listLoadComplete = new Promise<void>((resolve) => {
      resolveListLoadComplete = resolve;
    });

    function Setup(): React.ReactElement {
      const { setActiveTab, loadLetterboxdList } = useAppState();
      React.useEffect(() => {
        setActiveTab("list");
        void loadLetterboxdList("https://letterboxd.com/test-user/watchlist/", "US").finally(() => {
          resolveListLoadComplete?.();
        });
      }, [loadLetterboxdList, setActiveTab]);
      return <RightPanel />;
    }

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider>
          <Setup />
        </AppStateProvider>,
      );
    });

    await act(async () => {
      await listLoadComplete;
    });

    expect(container.querySelector('img[alt="Alternative search"]')).not.toBeNull();
  });
});
