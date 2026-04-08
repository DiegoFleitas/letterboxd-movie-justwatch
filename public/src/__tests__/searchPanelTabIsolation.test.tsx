// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createInitialTabbedTileState, mergeTileStateForTab } from "../movieTiles";
import { AppStateProvider, selectActiveTileState } from "../AppStateContext";
import { LeftPanel } from "../LeftPanel";

const COUNTRY_STORAGE_KEY = "letterboxd-justwatch-country";

describe("search panel tab isolation model", () => {
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
});
