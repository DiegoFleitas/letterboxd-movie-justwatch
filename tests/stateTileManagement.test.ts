import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const letterboxd = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "api", "letterboxd-watchlist.json"), "utf-8"),
);
const searchMovieData = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "api", "search-movie.json"), "utf-8"),
);

const watchlist = letterboxd[0]?.response?.watchlist || [];
const herPrivateHell = watchlist.find((f: { title?: string }) => f.title === "Her Private Hell");
const lakeMungo = watchlist.find((f: { title?: string }) => f.title === "Lake Mungo");
const lakeMungoSearch = searchMovieData.find(
  (f: { request?: { title?: string }; response?: { year?: string; poster?: string } }) =>
    f.request?.title === "Lake Mungo",
)?.response;

function generateTileId(title: string, year: string | null): string {
  return `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;
}

interface TileData {
  id?: string;
  title?: string;
  year?: string | null;
  link?: string;
  poster?: string;
  movieProviders?: unknown[];
}

function updateMovieTile(
  state: { movieTiles: Record<string, TileData> },
  title: string,
  year: string | null,
  data: Partial<TileData>,
): { id: string; updated: boolean; oldId?: string } {
  const id = generateTileId(title, year);
  if (data?.link) {
    for (const [existingId, tileData] of Object.entries(state.movieTiles)) {
      if (tileData.link === data.link && existingId !== id) {
        state.movieTiles[id] = { ...tileData, ...data, year: year ?? undefined };
        delete state.movieTiles[existingId];
        return { id, updated: true, oldId: existingId };
      }
    }
  }
  if (state.movieTiles[id]) {
    state.movieTiles[id] = { ...state.movieTiles[id], ...data, year: year ?? undefined };
    return { id, updated: true };
  }
  state.movieTiles[id] = { id, title, year: year ?? undefined, ...data };
  return { id, updated: false };
}

describe("state tile ID management", () => {
  it("generates correct tile ID", () => {
    expect(generateTileId("The Greatest Hits", "2024")).toBe("2024-THEGREATESTHITS");
  });

  it("handles special characters in title", () => {
    expect(generateTileId("It's Never Over, Jeff Buckley", "2025")).toBe(
      "2025-ITSNEVEROVERJEFFBUCKLEY",
    );
  });

  it("handles null year", () => {
    expect(generateTileId("Her Private Hell", null)).toBe("null-HERPRIVATEHELL");
  });

  it("creates new tile when it doesn't exist", () => {
    const state: { movieTiles: Record<string, TileData> } = { movieTiles: {} };
    const result = updateMovieTile(state, "Test Movie", "2024", {
      link: "https://letterboxd.com/film/test/",
      movieProviders: [],
    });
    expect(result.updated).toBe(false);
    expect(state.movieTiles["2024-TESTMOVIE"]).toBeTruthy();
  });

  it("updates existing tile with same ID", () => {
    const state = {
      movieTiles: {
        "2024-TESTMOVIE": {
          id: "2024-TESTMOVIE",
          title: "Test Movie",
          year: "2024",
          movieProviders: [],
        },
      },
    };
    const result = updateMovieTile(state, "Test Movie", "2024", {
      link: "https://letterboxd.com/film/test/",
      movieProviders: [{ name: "Netflix" }],
    });
    expect(result.updated).toBe(true);
    expect((state.movieTiles["2024-TESTMOVIE"].movieProviders as unknown[]).length).toBe(1);
  });

  it("moves tile to new ID when year changes", () => {
    const film =
      herPrivateHell ||
      ({
        title: "Her Private Hell",
        year: null,
        link: "https://letterboxd.com/film/her-private-hell-1/",
      } as TileData);
    const state: { movieTiles: Record<string, TileData> } = {
      movieTiles: {
        "null-HERPRIVATEHELL": {
          id: "null-HERPRIVATEHELL",
          title: film.title,
          year: String(film.year),
          link: film.link,
          movieProviders: [],
        },
      },
    };
    const result = updateMovieTile(state, film.title!, "2026", {
      link: film.link,
      movieProviders: [],
    });
    expect(result.id).toBe("2026-HERPRIVATEHELL");
    expect(result.oldId).toBe("null-HERPRIVATEHELL");
    expect(state.movieTiles["2026-HERPRIVATEHELL"]).toBeTruthy();
    expect("null-HERPRIVATEHELL" in state.movieTiles).toBe(false);
  });

  it("preserves data when moving to new ID", () => {
    const film =
      lakeMungo ||
      ({
        title: "Lake Mungo",
        year: "2008",
        link: "https://letterboxd.com/film/lake-mungo/",
      } as TileData);
    const newYear = (lakeMungoSearch as { year?: string })?.year ?? "2009";
    const poster =
      (lakeMungoSearch as { poster?: string })?.poster ?? "https://example.com/poster.jpg";
    const state: { movieTiles: Record<string, TileData> } = {
      movieTiles: {
        "2008-LAKEMUNGO": {
          id: "2008-LAKEMUNGO",
          title: film.title,
          year: film.year,
          link: film.link,
          poster,
          movieProviders: [],
        },
      },
    };
    updateMovieTile(state, film.title!, String(newYear), {
      link: film.link,
      movieProviders: [{ name: "Disney Plus" }],
    });
    const newTile = state.movieTiles[`${newYear}-LAKEMUNGO`]!;
    expect(newTile.poster).toBe(poster);
    expect((newTile.movieProviders as unknown[]).length).toBe(1);
    expect(newTile.year).toBe(String(newYear));
  });
});
