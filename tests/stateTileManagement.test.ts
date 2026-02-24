/**
 * Unit tests for state tile ID management
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { TestSuite, assertEqual, assert, assertTruthy } from "./testUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const letterboxd = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "api", "letterboxd-watchlist.json"), "utf-8")
);
const searchMovieData = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "api", "search-movie.json"), "utf-8")
);

const watchlist = letterboxd[0]?.response?.watchlist || [];
const herPrivateHell = watchlist.find((f: { title?: string }) => f.title === "Her Private Hell");
const lakeMungo = watchlist.find((f: { title?: string }) => f.title === "Lake Mungo");
const lakeMungoSearch = searchMovieData.find(
  (f: { request?: { title?: string }; response?: { year?: string; poster?: string } }) =>
    f.request?.title === "Lake Mungo"
)?.response;

const suite = new TestSuite("State Tile Management");

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
  data: Partial<TileData>
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

suite.test("Should generate correct tile ID", () => {
  assertEqual(generateTileId("The Greatest Hits", "2024"), "2024-THEGREATESTHITS");
});

suite.test("Should handle special characters in title", () => {
  assertEqual(
    generateTileId("It's Never Over, Jeff Buckley", "2025"),
    "2025-ITSNEVEROVERJEFFBUCKLEY"
  );
});

suite.test("Should handle null year", () => {
  assertEqual(generateTileId("Her Private Hell", null), "null-HERPRIVATEHELL");
});

suite.test("Should create new tile when it doesn't exist", () => {
  const state = { movieTiles: {} as Record<string, TileData> };
  const result = updateMovieTile(state, "Test Movie", "2024", {
    link: "https://letterboxd.com/film/test/",
    movieProviders: [],
  });
  assertEqual(result.updated, false);
  assertTruthy(state.movieTiles["2024-TESTMOVIE"]);
});

suite.test("Should update existing tile with same ID", () => {
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
  assertEqual(result.updated, true);
  assertEqual((state.movieTiles["2024-TESTMOVIE"].movieProviders as unknown[]).length, 1);
});

suite.test("Should move tile to new ID when year changes", () => {
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
  assertEqual(result.id, "2026-HERPRIVATEHELL");
  assertEqual(result.oldId, "null-HERPRIVATEHELL");
  assertTruthy(state.movieTiles["2026-HERPRIVATEHELL"]);
  assert(!("null-HERPRIVATEHELL" in state.movieTiles));
});

suite.test("Should preserve data when moving to new ID", () => {
  const film =
    lakeMungo ||
    ({
      title: "Lake Mungo",
      year: "2008",
      link: "https://letterboxd.com/film/lake-mungo/",
    } as TileData);
  const newYear = (lakeMungoSearch as { year?: string })?.year ?? "2009";
  const poster = (lakeMungoSearch as { poster?: string })?.poster ?? "https://example.com/poster.jpg";
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
  assertEqual(newTile.poster, poster);
  assertEqual((newTile.movieProviders as unknown[]).length, 1);
  assertEqual(newTile.year, String(newYear));
});

const results = await suite.run();
process.exit(results.failed > 0 ? 1 : 0);
