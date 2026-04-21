import { describe, it, expect } from "vitest";
import { buildMovieMergeData, type MovieSearchResponse } from "../useMovieSearch";
import { LEGACY_PLACEHOLDER_POSTER, PLACEHOLDER_POSTER } from "../movieTiles";

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
    expect(data.poster).toBe(PLACEHOLDER_POSTER);
  });

  it("normalizes legacy placeholder poster to BASE_URL-aware placeholder", () => {
    const response: MovieSearchResponse = {
      title: "Legacy Placeholder",
      year: "2025",
      poster: LEGACY_PLACEHOLDER_POSTER,
    };

    const data = buildMovieMergeData(response);
    expect(data.poster).toBe(PLACEHOLDER_POSTER);
  });

  it("maps imdbLink and tmdbLink from search response into merge payload", () => {
    const response: MovieSearchResponse = {
      title: "Rashomon",
      year: "1950",
      link: "https://letterboxd.com/imdb/tt0042876",
      imdbLink: "https://www.imdb.com/title/tt0042876/",
      tmdbLink: "https://www.themoviedb.org/movie/548/",
      poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
    };

    const data = buildMovieMergeData(response);

    expect(data.link).toBe("https://letterboxd.com/imdb/tt0042876");
    expect(data.imdbLink).toBe("https://www.imdb.com/title/tt0042876/");
    expect(data.tmdbLink).toBe("https://www.themoviedb.org/movie/548/");
  });
});
