import { describe, it, expect } from "vitest";
import { buildOpenSubtitlesBrowseUrl } from "../opensubtitlesUrl";

describe("buildOpenSubtitlesBrowseUrl", () => {
  it("uses imdb:tt search query when IMDb link is present", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("Inception", "2010", "https://www.imdb.com/title/tt1375666/"),
    ).toBe("https://www.opensubtitles.com/en/subtitles?query=imdb%3Att1375666");
  });

  it("preserves tt id including leading zeros in imdb: query", () => {
    expect(buildOpenSubtitlesBrowseUrl("x", undefined, "https://imdb.com/title/tt0499549/")).toBe(
      "https://www.opensubtitles.com/en/subtitles?query=imdb%3Att0499549",
    );
  });

  it("falls back to title search when no IMDb or TMDB link", () => {
    expect(buildOpenSubtitlesBrowseUrl("The Big Lebowski", "1998")).toBe(
      "https://www.opensubtitles.com/en/subtitles?query=The+Big+Lebowski+1998",
    );
  });

  it("uses title-only query when year is absent", () => {
    expect(buildOpenSubtitlesBrowseUrl("Solaris")).toBe(
      "https://www.opensubtitles.com/en/subtitles?query=Solaris",
    );
  });

  it("uses imdb when link uses www.imdb.com", () => {
    expect(
      buildOpenSubtitlesBrowseUrl("x", undefined, "http://www.imdb.com/title/tt0816692/"),
    ).toBe("https://www.opensubtitles.com/en/subtitles?query=imdb%3Att0816692");
  });

  it("uses tmdb:N query when TMDB link present but no IMDb", () => {
    expect(
      buildOpenSubtitlesBrowseUrl(
        "Ghost",
        "1990",
        undefined,
        "https://www.themoviedb.org/movie/9489/ghost",
      ),
    ).toBe("https://www.opensubtitles.com/en/subtitles?query=tmdb%3A9489");
  });

  it("prefers IMDb over TMDB when both links exist", () => {
    expect(
      buildOpenSubtitlesBrowseUrl(
        "Ghost",
        "1990",
        "https://www.imdb.com/title/tt0099733/",
        "https://www.themoviedb.org/movie/9489/",
      ),
    ).toBe("https://www.opensubtitles.com/en/subtitles?query=imdb%3Att0099733");
  });
});
