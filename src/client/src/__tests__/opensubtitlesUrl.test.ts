import { describe, it, expect } from "vitest";
import { buildOpenSubtitlesBrowseUrl } from "../opensubtitlesUrl";

describe("buildOpenSubtitlesBrowseUrl", () => {
  it("uses imdbid search when IMDb link is present", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("Inception", "2010", "https://www.imdb.com/title/tt1375666/"),
    ).toBe("https://www.opensubtitles.com/en/search/sublanguageid-all/imdbid-1375666");
  });

  it("strips leading zeros from tt id for imdbid segment", () => {
    expect(buildOpenSubtitlesBrowseUrl("x", undefined, "https://imdb.com/title/tt0499549/")).toBe(
      "https://www.opensubtitles.com/en/search/sublanguageid-all/imdbid-499549",
    );
  });

  it("falls back to moviename when no IMDb link", () => {
    expect(buildOpenSubtitlesBrowseUrl("The Big Lebowski", "1998")).toBe(
      "https://www.opensubtitles.com/en/search/sublanguageid-all/moviename-The%20Big%20Lebowski%201998",
    );
  });

  it("uses title-only moviename when year is absent", () => {
    expect(buildOpenSubtitlesBrowseUrl("Solaris")).toBe(
      "https://www.opensubtitles.com/en/search/sublanguageid-all/moviename-Solaris",
    );
  });

  it("uses imdb when link uses www.imdb.com", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("x", undefined, "http://www.imdb.com/title/tt0816692/"),
    ).toBe("https://www.opensubtitles.com/en/search/sublanguageid-all/imdbid-816692");
  });
});
