import { describe, it, expect } from "vitest";
import { buildMovieMergeData, type MovieSearchResponse } from "../useMovieSearch";

describe("movie search poster write mapping", () => {
  it("maps movie search response to tile merge payload", () => {
    const response: MovieSearchResponse = {
      title: "The Matrix",
      year: "1999",
      link: "https://letterboxd.com/film/the-matrix/",
      poster: "https://image.tmdb.org/t/p/w500/the-matrix.jpg",
      movieProviders: [{ id: "nfx", name: "Netflix", url: "https://netflix.com/title/1" }],
    };

    const data = buildMovieMergeData(response);

    expect(data.poster).toBe("https://image.tmdb.org/t/p/w500/the-matrix.jpg");
    expect(data.link).toBe("https://letterboxd.com/film/the-matrix/");
    expect(data.movieProviders?.[0]?.name).toBe("Netflix");
  });

  it("falls back to placeholder poster when API omits poster", () => {
    const response: MovieSearchResponse = {
      title: "Unknown Movie",
      year: "2025",
      link: "https://letterboxd.com/film/unknown-movie/",
    };

    const data = buildMovieMergeData(response);
    expect(data.poster).toBe("/movie_placeholder.svg");
  });
});
