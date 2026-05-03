import { describe, it, expect } from "vitest";
import { buildOpenSubtitlesBrowseUrl } from "../opensubtitlesUrl";

const TAIL = "/hearing_impaired-include/machine_translated-/trusted_sources-";
const BASE = "https://www.opensubtitles.com/en/en/search-all";

describe("buildOpenSubtitlesBrowseUrl", () => {
  it("uses search-all path with tt id when IMDb link is present", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("Inception", "2010", "https://www.imdb.com/title/tt1375666/"),
    ).toBe(`${BASE}/q-tt1375666${TAIL}`);
  });

  it("preserves tt id including leading zeros in q segment", () => {
    expect(buildOpenSubtitlesBrowseUrl("x", undefined, "https://imdb.com/title/tt0499549/")).toBe(
      `${BASE}/q-tt0499549${TAIL}`,
    );
  });

  it("falls back to title search when no IMDb or TMDB link", () => {
    expect(buildOpenSubtitlesBrowseUrl("The Big Lebowski", "1998")).toBe(
      `${BASE}/q-${encodeURIComponent("The Big Lebowski 1998")}${TAIL}`,
    );
  });

  it("uses title-only token when year is absent", () => {
    expect(buildOpenSubtitlesBrowseUrl("Solaris")).toBe(`${BASE}/q-Solaris${TAIL}`);
  });

  it("uses imdb when link uses www.imdb.com", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("x", undefined, "http://www.imdb.com/title/tt0816692/"),
    ).toBe(`${BASE}/q-tt0816692${TAIL}`);
  });

  it("uses tmdb:N token when TMDB link present but no IMDb", () => {
    expect(
      buildOpenSubtitlesBrowseUrl(
        "Ghost",
        "1990",
        undefined,
        "https://www.themoviedb.org/movie/9489/ghost",
      ),
    ).toBe(`${BASE}/q-${encodeURIComponent("tmdb:9489")}${TAIL}`);
  });

  it("parses TMDB id from localized themoviedb.org movie paths", () => {
    expect(
      buildOpenSubtitlesBrowseUrl(
        "Pulp Fiction",
        "1994",
        undefined,
        "https://www.themoviedb.org/es/movie/680-pulp-fiction",
      ),
    ).toBe(`${BASE}/q-${encodeURIComponent("tmdb:680")}${TAIL}`);
  });

  it("ignores non-TMDB URLs for tmdb fallback", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("x", "2000", undefined, "https://letterboxd.com/film/foo/"),
    ).toBe(`${BASE}/q-${encodeURIComponent("x 2000")}${TAIL}`);
  });

  it("prefers IMDb over TMDB when both links exist", () => {
    expect(
      buildOpenSubtitlesBrowseUrl(
        "Ghost",
        "1990",
        "https://www.imdb.com/title/tt0099733/",
        "https://www.themoviedb.org/movie/9489/",
      ),
    ).toBe(`${BASE}/q-tt0099733${TAIL}`);
  });
});
