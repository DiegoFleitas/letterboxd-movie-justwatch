// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MovieTile } from "../MovieTile";
import { AppStateProvider } from "../AppStateContext";
import type { TileData } from "../movieTiles";
import { stubMatchMedia } from "./mockMatchMedia";

describe("MovieTile providers and actions", () => {
  const baseTile: TileData = {
    id: "2020-TEST",
    title: "Test Film",
    year: "2020",
    poster: "https://example.com/p.jpg",
    link: "https://letterboxd.com/film/test/",
    imdbLink: "https://www.imdb.com/title/tt0099999/",
    tmdbLink: "https://www.themoviedb.org/movie/99",
    movieProviders: [
      {
        id: "nfx",
        name: "Netflix",
        icon: "https://example.com/n.png",
        url: "https://netflix.com/watch",
      },
    ],
  };

  beforeEach(() => {
    stubMatchMedia(false);
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens JustWatch proxy URL when clicking a streaming provider", () => {
    const onAlt = vi.fn();
    render(
      <AppStateProvider>
        <MovieTile data={baseTile} onAlternativeSearch={onAlt} suppressAnimations />
      </AppStateProvider>,
    );
    const providerBtn = screen.getByTitle("Netflix");
    fireEvent.click(providerBtn);
    expect(window.open).toHaveBeenCalled();
    const opened = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(opened).toContain("click.justwatch.com");
    expect(opened).toContain("netflix.com");
  });

  it("calls onAlternativeSearch when alt button clicked", () => {
    const onAlt = vi.fn();
    render(
      <AppStateProvider>
        <MovieTile data={baseTile} onAlternativeSearch={onAlt} suppressAnimations />
      </AppStateProvider>,
    );
    fireEvent.click(screen.getByTitle("Alternative search"));
    expect(onAlt).toHaveBeenCalledWith(expect.objectContaining({ title: "Test Film" }));
  });

  it("shows +N toggle and opens menu with hidden providers", () => {
    const manyProviders = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      name: `Prov${i}`,
      icon: `https://example.com/${i}.png`,
      url: `https://jw.example/${i}`,
    }));
    render(
      <AppStateProvider>
        <MovieTile data={{ ...baseTile, movieProviders: manyProviders }} suppressAnimations />
      </AppStateProvider>,
    );
    expect(screen.getByTitle("Prov0")).toBeTruthy();
    expect(screen.getByTitle("Prov3")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();

    const toggle = screen.getByTestId("provider-surplus-toggle");
    expect(toggle.textContent?.trim()).toBe("+1");
    expect(toggle.getAttribute("title")).toBe("Also available: Prov4");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu", { name: "Additional streaming providers" })).toBeTruthy();
    const hiddenBtn = screen.getByTitle("Prov4");
    expect(hiddenBtn).toBeTruthy();

    fireEvent.click(hiddenBtn);

    expect(window.open).toHaveBeenCalled();
    const opened = (window.open as ReturnType<typeof vi.fn>).mock.calls.pop()?.[0] as string;
    expect(opened).toContain("click.justwatch.com");
    expect(opened).toContain("jw.example/4");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders skeleton when poster missing", () => {
    const noPoster: TileData = {
      id: "x",
      title: "No Poster",
      link: "https://letterboxd.com/film/noposter/",
      movieProviders: [],
    };
    render(
      <AppStateProvider>
        <MovieTile data={noPoster} suppressAnimations />
      </AppStateProvider>,
    );
    expect(document.querySelector(".poster-skeleton")).toBeTruthy();
  });
});
