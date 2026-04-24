// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { AppStateProvider } from "../AppStateContext";
import { MovieTile } from "../MovieTile";
import type { TileData } from "../movieTiles";

describe("MovieTile poster corner subtitle buttons", () => {
  it("renders SubDL and OpenSubtitles controls in the external stack", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData: TileData = {
      id: "tile-1",
      title: "Test Film",
      year: "2001",
      link: "https://letterboxd.com/film/test-film/",
      imdbLink: "https://www.imdb.com/title/tt0123456/",
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    expect(container.querySelector('[data-sp="subdl-link-tile"]')).not.toBeNull();
    expect(container.querySelector('[data-sp="opensubtitles-link-tile"]')).not.toBeNull();
    const subdlIcon = container.querySelector(
      '[data-sp="subdl-link-tile"] img',
    ) as HTMLImageElement | null;
    const subdlIconSrc = subdlIcon?.getAttribute("src") ?? "";
    expect(subdlIconSrc).toContain("subdl-icon.svg");
    expect(subdlIconSrc.length).toBeGreaterThan(0);
  });

  it("renders SubDL and OpenSubtitles when no other external links exist", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData = {
      id: "tile-2",
      title: "Obscure",
      year: "2020",
      movieProviders: [],
    } as unknown as TileData;

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    expect(container.querySelector('[data-sp="subdl-link-tile"]')).not.toBeNull();
    expect(container.querySelector('[data-sp="opensubtitles-link-tile"]')).not.toBeNull();
    expect(container.querySelector('[data-sp="letterboxd-link-tile"]')).toBeNull();
  });
});
