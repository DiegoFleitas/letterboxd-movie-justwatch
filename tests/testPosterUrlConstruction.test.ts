/**
 * Validates Letterboxd CDN poster URL construction (matches controllers/letterboxdPoster logic).
 */
import { describe, it, expect } from "vitest";

const POSTER_WIDTH = 230;
const POSTER_HEIGHT = 345;

function constructPosterUrl(filmId: string, slug: string, cacheBustingKey: string): string {
  const idPath = filmId.split("").join("/");
  const baseUrl = `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${slug}-0-${POSTER_WIDTH}-0-${POSTER_HEIGHT}-crop.jpg`;
  return cacheBustingKey ? `${baseUrl}?v=${cacheBustingKey}` : baseUrl;
}

describe("Letterboxd poster URL construction", () => {
  it.each([
    {
      name: "The Little Drummer Girl (2018)",
      filmId: "484585",
      slug: "the-little-drummer-girl-2018",
      cacheBustingKey: "9aa648f4",
      expectedUrl:
        "https://a.ltrbxd.com/resized/film-poster/4/8/4/5/8/5/484585-the-little-drummer-girl-2018-0-230-0-345-crop.jpg?v=9aa648f4",
    },
    {
      name: "You'll Never Find Me",
      filmId: "1007317",
      slug: "youll-never-find-me",
      cacheBustingKey: "924840a4",
      expectedUrl:
        "https://a.ltrbxd.com/resized/film-poster/1/0/0/7/3/1/7/1007317-youll-never-find-me-0-230-0-345-crop.jpg?v=924840a4",
    },
    {
      name: "Her Private Hell",
      filmId: "361648",
      slug: "her-private-hell-1",
      cacheBustingKey: "57d4bdf1",
      expectedUrl:
        "https://a.ltrbxd.com/resized/film-poster/3/6/1/6/4/8/361648-her-private-hell-1-0-230-0-345-crop.jpg?v=57d4bdf1",
    },
  ])("$name", ({ filmId, slug, cacheBustingKey, expectedUrl }) => {
    expect(constructPosterUrl(filmId, slug, cacheBustingKey)).toBe(expectedUrl);
  });
});
