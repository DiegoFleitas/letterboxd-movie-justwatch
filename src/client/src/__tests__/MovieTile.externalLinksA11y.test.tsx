// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { AppStateProvider } from "../AppStateContext";
import { MovieTile } from "../MovieTile";
import type { TileData } from "../movieTiles";
import { stubMatchMedia } from "./mockMatchMedia";

describe("MovieTile external links accessibility label", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes rendered external links and SubDL in group label", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData: TileData = {
      id: "1999-FOO",
      title: "Foo",
      year: "1999",
      link: "https://letterboxd.com/film/foo/",
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    const externalGroup = container.querySelector("fieldset.poster-external-stack");
    expect(externalGroup?.getAttribute("aria-label")).toBe(
      "Foo (1999) — Letterboxd, SubDL, OpenSubtitles",
    );
  });

  it("omits SubDL and OpenSubtitles from group label on narrow viewport", async () => {
    stubMatchMedia(true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData: TileData = {
      id: "1999-BAR",
      title: "Bar",
      year: "1999",
      link: "https://letterboxd.com/film/bar/",
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    const externalGroup = container.querySelector("fieldset.poster-external-stack");
    expect(externalGroup?.getAttribute("aria-label")).toBe("Bar (1999) — Letterboxd");
  });
});
