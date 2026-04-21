import { describe, it, expect } from "vitest";
import { createInitialTileState, mergeTileState, normalizeLetterboxdFilmLink } from "../movieTiles";

describe("normalizeLetterboxdFilmLink", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeLetterboxdFilmLink("")).toBe("");
  });

  it("leaves absolute https URLs unchanged", () => {
    expect(normalizeLetterboxdFilmLink("https://letterboxd.com/film/foo/")).toBe(
      "https://letterboxd.com/film/foo/",
    );
  });

  it("prefixes root-relative Letterboxd paths", () => {
    expect(normalizeLetterboxdFilmLink("/film/rashomon/")).toBe(
      "https://letterboxd.com/film/rashomon/",
    );
  });

  it("prefixes paths without leading slash", () => {
    expect(normalizeLetterboxdFilmLink("film/foo/")).toBe("https://letterboxd.com/film/foo/");
  });

  it("normalizes protocol-relative URLs", () => {
    expect(normalizeLetterboxdFilmLink("//letterboxd.com/film/foo/")).toBe(
      "https://letterboxd.com/film/foo/",
    );
  });
});

describe("mergeTileState link and external refs", () => {
  it("stores normalized absolute Letterboxd link from relative path", () => {
    const next = mergeTileState(createInitialTileState(), "Rashomon", "1950", {
      link: "/film/rashomon/",
      poster: null,
      movieProviders: [],
    });
    expect(next.movieTiles["1950-RASHOMON"]?.link).toBe("https://letterboxd.com/film/rashomon/");
  });

  it("merges imdbLink and tmdbLink from API payload", () => {
    const next = mergeTileState(createInitialTileState(), "Test", "2020", {
      link: "https://letterboxd.com/film/test/",
      imdbLink: "https://www.letterboxd.com/imdb/tt0042876",
      tmdbLink: "https://www.themoviedb.org/movie/548/",
      poster: null,
      movieProviders: [],
    });
    const tile = next.movieTiles["2020-TEST"];
    expect(tile?.imdbLink).toBe("https://www.letterboxd.com/imdb/tt0042876");
    expect(tile?.tmdbLink).toBe("https://www.themoviedb.org/movie/548/");
  });

  it("preserves existing imdbLink and tmdbLink when merge omits them", () => {
    const seeded = mergeTileState(createInitialTileState(), "Keep", "2021", {
      link: "https://letterboxd.com/film/keep/",
      imdbLink: "https://www.letterboxd.com/imdb/tt11111111",
      tmdbLink: "https://www.themoviedb.org/movie/999/",
      poster: null,
      movieProviders: [],
    });
    const next = mergeTileState(seeded, "Keep", "2021", {
      poster: null,
      movieProviders: [{ id: "nfx", name: "Netflix", url: "https://example.com/watch" }],
    });
    const tile = next.movieTiles["2021-KEEP"];
    expect(tile?.imdbLink).toBe("https://www.letterboxd.com/imdb/tt11111111");
    expect(tile?.tmdbLink).toBe("https://www.themoviedb.org/movie/999/");
  });
});
