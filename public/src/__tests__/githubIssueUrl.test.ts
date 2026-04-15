import { describe, it, expect } from "vitest";
import { buildListGithubIssueUrl, listReportToastCopy } from "../githubIssueUrl";
import {
  classifyListReportSymptom,
  isPlaceholderPoster,
  mergeTileState,
  createInitialTileState,
} from "../movieTiles";

describe("buildListGithubIssueUrl", () => {
  const base = "https://example.com/org/repo/issues/new";
  const ctxNoTiles = {
    symptom: "no_tiles" as const,
    country: "US",
    listSource: "letterboxd_url" as const,
    listUrl: "https://letterboxd.com/user/watchlist/",
    lastBatchFilmCount: 3,
    totalPages: 1,
    lastPage: 1,
    tileCount: 0,
    pageUrl: "https://app.example/",
    userAgent: "Vitest",
  };

  it("encodes title and body for no_tiles", () => {
    const url = buildListGithubIssueUrl(ctxNoTiles, { issuesNewBase: base });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(base);
    expect(u.searchParams.get("title")).toBe("[List] No tiles after search");
    const body = u.searchParams.get("body") ?? "";
    expect(body).toContain("symptom: no_tiles");
    expect(body).toContain("No movie tiles");
    expect(body).toContain("https://app.example/");
    expect(body).toContain("Letterboxd list URL: https://letterboxd.com/user/watchlist/");
    expect(body).toContain("Vitest");
  });

  it("uses distinct title for all_placeholder_posters", () => {
    const url = buildListGithubIssueUrl(
      {
        symptom: "all_placeholder_posters",
        country: "GB",
        listSource: "letterboxd_url",
        listUrl: "https://letterboxd.com/user/watchlist/",
        lastBatchFilmCount: 2,
        totalPages: 1,
        lastPage: 1,
        tileCount: 2,
        pageUrl: "https://app.example/list",
        userAgent: "UA",
      },
      { issuesNewBase: base },
    );
    expect(new URL(url).searchParams.get("title")).toBe(
      "[List] Posters still placeholders after search",
    );
    const body = new URL(url).searchParams.get("body") ?? "";
    expect(body).toContain("symptom: all_placeholder_posters");
    expect(body).toContain("Letterboxd URL");
    expect(body).toContain("Letterboxd list URL: https://letterboxd.com/user/watchlist/");
  });

  it("preserves newlines in body via URLSearchParams", () => {
    const url = buildListGithubIssueUrl(ctxNoTiles, { issuesNewBase: base });
    const body = new URL(url).searchParams.get("body") ?? "";
    expect(body.split("\n").length).toBeGreaterThan(5);
  });
});

describe("listReportToastCopy", () => {
  it("differs by symptom", () => {
    expect(listReportToastCopy("no_tiles")).toContain("no tiles");
    expect(listReportToastCopy("all_placeholder_posters")).toContain("posters");
  });
});

describe("isPlaceholderPoster & classifyListReportSymptom", () => {
  it("treats null and placeholder path as placeholder", () => {
    expect(isPlaceholderPoster(null)).toBe(true);
    expect(isPlaceholderPoster(undefined)).toBe(true);
    expect(isPlaceholderPoster("/movie_placeholder.svg")).toBe(true);
    expect(isPlaceholderPoster("https://example.com/p.jpg")).toBe(false);
  });

  it("classifies empty tiles as no_tiles", () => {
    expect(classifyListReportSymptom({})).toBe("no_tiles");
  });

  it("classifies all-placeholder as all_placeholder_posters", () => {
    const state = mergeTileState(createInitialTileState(), "Foo", 2020, {
      poster: "/movie_placeholder.svg",
      link: "https://letterboxd.com/film/foo/",
    });
    expect(classifyListReportSymptom(state.movieTiles)).toBe("all_placeholder_posters");
    const withReal = mergeTileState(state, "Foo", 2020, {
      poster: "https://cdn.example/p.jpg",
      link: "https://letterboxd.com/film/foo/",
    });
    expect(classifyListReportSymptom(withReal.movieTiles)).toBe(null);
  });
});
