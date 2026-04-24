// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { MovieTile } from "../MovieTile";
import type { TileData } from "../movieTiles";

describe("MovieTile coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders poster skeleton when poster is missing", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData: TileData = {
      id: "no-poster",
      title: "No Art",
      year: "2021",
      link: "https://letterboxd.com/film/no-art/",
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={{ ...tileData, poster: null }} suppressAnimations />
        </AppStateProvider>,
      );
    });

    expect(container.querySelector(".poster-skeleton")).not.toBeNull();
    expect(container.querySelector('img[alt="No Art Poster"]')).toBeNull();
  });

  it("opens JustWatch proxy URL when a streaming provider button is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const container = document.createElement("div");
    const root = createRoot(container);
    const jwUrl = "https://www.justwatch.com/us/movie/foo";
    const tileData: TileData = {
      id: "prov-1",
      title: "Stream Me",
      year: "2019",
      link: "https://letterboxd.com/film/stream-me/",
      movieProviders: [{ id: "nf", name: "Netflix", icon: "/icon.png", url: jwUrl }],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    const btn = container.querySelector('[data-sp="Netflix"]') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    await act(async () => {
      btn?.click();
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [opened] = openSpy.mock.calls[0] as [string, string];
    expect(opened).toBe(`https://click.justwatch.com/a?r=${jwUrl}`);
    expect(openSpy.mock.calls[0][1]).toBe("_blank");
  });

  it("invokes onAlternativeSearch when alternative search is clicked", async () => {
    const onAlt = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    const tileData: TileData = {
      id: "alt-1",
      title: "Alt Film",
      year: "2000",
      link: "https://letterboxd.com/film/alt-film/",
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations onAlternativeSearch={onAlt} />
        </AppStateProvider>,
      );
    });

    const altBtn = container.querySelector(
      '[data-sp="alternative-search-tile"]',
    ) as HTMLButtonElement | null;
    await act(async () => {
      altBtn?.click();
    });

    expect(onAlt).toHaveBeenCalledTimes(1);
    expect(onAlt).toHaveBeenCalledWith(tileData);
  });

  it("opens TMDB and IMDb URLs from external buttons", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const container = document.createElement("div");
    const root = createRoot(container);
    const tmdb = "https://www.themoviedb.org/movie/1";
    const imdb = "https://www.imdb.com/title/tt0099999/";
    const tileData: TileData = {
      id: "links-1",
      title: "Linked",
      year: "1995",
      link: "https://letterboxd.com/film/linked/",
      tmdbLink: tmdb,
      imdbLink: imdb,
      movieProviders: [],
    };

    await act(async () => {
      root.render(
        <AppStateProvider>
          <MovieTile data={tileData} suppressAnimations />
        </AppStateProvider>,
      );
    });

    const tmdbBtn = container.querySelector(
      '[data-sp="tmdb-link-tile"]',
    ) as HTMLButtonElement | null;
    const imdbBtn = container.querySelector(
      '[data-sp="imdb-link-tile"]',
    ) as HTMLButtonElement | null;
    expect(tmdbBtn).not.toBeNull();
    expect(imdbBtn).not.toBeNull();

    await act(async () => {
      tmdbBtn?.click();
    });
    expect(openSpy).toHaveBeenLastCalledWith(tmdb, "_blank", "noopener,noreferrer");

    await act(async () => {
      imdbBtn?.click();
    });
    expect(openSpy).toHaveBeenLastCalledWith(imdb, "_blank", "noopener,noreferrer");
  });
});
