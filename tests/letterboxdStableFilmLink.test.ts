import { describe, it, expect } from "vitest";
import {
  buildLetterboxdImdbBridgeLink,
  buildLetterboxdStableFilmLink,
  buildLetterboxdTmdbBridgeLink,
} from "@server/lib/letterboxdStableFilmLink.js";

describe("buildLetterboxdImdbBridgeLink", () => {
  it("returns undefined for empty input", () => {
    expect(buildLetterboxdImdbBridgeLink(undefined)).toBeUndefined();
    expect(buildLetterboxdImdbBridgeLink("")).toBeUndefined();
    expect(buildLetterboxdImdbBridgeLink("  ")).toBeUndefined();
  });

  it("builds imdb bridge URL", () => {
    expect(buildLetterboxdImdbBridgeLink("tt0042876")).toBe(
      "https://letterboxd.com/imdb/tt0042876",
    );
  });
});

describe("buildLetterboxdTmdbBridgeLink", () => {
  it("returns undefined for empty input", () => {
    expect(buildLetterboxdTmdbBridgeLink(undefined)).toBeUndefined();
    expect(buildLetterboxdTmdbBridgeLink("")).toBeUndefined();
  });

  it("builds tmdb bridge URL", () => {
    expect(buildLetterboxdTmdbBridgeLink(548)).toBe("https://letterboxd.com/tmdb/548");
  });
});

describe("buildLetterboxdStableFilmLink", () => {
  it("prefers imdb over tmdb", () => {
    expect(buildLetterboxdStableFilmLink("tt0042876", 999)).toBe(
      "https://letterboxd.com/imdb/tt0042876",
    );
  });

  it("uses tmdb when imdb is missing", () => {
    expect(buildLetterboxdStableFilmLink(undefined, 548)).toBe("https://letterboxd.com/tmdb/548");
  });
});
