/**
 * Unit tests for filter logic
 */
import { TestSuite, assertEqual, assertArrayLength } from "./testUtils.js";

const suite = new TestSuite("Filter Logic");

const createMockState = () => ({
  movieTiles: {
    "2018-MOVIE1": { id: "2018-MOVIE1", title: "Movie 1", movieProviders: [] },
    "2024-MOVIE2": {
      id: "2024-MOVIE2",
      title: "Movie 2",
      movieProviders: [{ name: "Disney Plus", id: "disney" }],
    },
    "2020-MOVIE3": {
      id: "2020-MOVIE3",
      title: "Movie 3",
      movieProviders: [
        { name: "Netflix", id: "netflix" },
        { name: "Disney Plus", id: "disney" },
      ],
    },
    "1990-MOVIE4": {
      id: "1990-MOVIE4",
      title: "Movie 4",
      movieProviders: [{ name: "Netflix", id: "netflix" }],
    },
  },
});

function filterMovies(
  state: ReturnType<typeof createMockState>,
  selectedServices: string[]
): { visible: string[]; hidden: string[] } {
  const visible: string[] = [];
  const hidden: string[] = [];
  for (const [id, data] of Object.entries(state.movieTiles)) {
    const providerNames = (data.movieProviders ?? []).map((p: { name: string }) => p.name);
    if (providerNames.length === 0) {
      hidden.push(id);
    } else {
      const hasMatch = selectedServices.some((service) => providerNames.includes(service));
      if (hasMatch) visible.push(id);
      else hidden.push(id);
    }
  }
  return { visible, hidden };
}

suite.test("Should hide movies with no providers when filter is active", () => {
  const result = filterMovies(createMockState(), ["Disney Plus"]);
  assertEqual(result.hidden.includes("2018-MOVIE1"), true);
});

suite.test("Should show movies with matching provider", () => {
  const result = filterMovies(createMockState(), ["Disney Plus"]);
  assertEqual(result.visible.includes("2024-MOVIE2"), true);
  assertEqual(result.visible.includes("2020-MOVIE3"), true);
});

suite.test("Should hide movies without matching provider", () => {
  const result = filterMovies(createMockState(), ["Disney Plus"]);
  assertEqual(result.hidden.includes("1990-MOVIE4"), true);
});

suite.test("Should show correct count when filtering by Disney Plus", () => {
  const result = filterMovies(createMockState(), ["Disney Plus"]);
  assertArrayLength(result.visible, 2);
  assertArrayLength(result.hidden, 2);
});

suite.test("Should show correct movies when filtering by Netflix", () => {
  const result = filterMovies(createMockState(), ["Netflix"]);
  assertEqual(result.visible.includes("2020-MOVIE3"), true);
  assertEqual(result.visible.includes("1990-MOVIE4"), true);
  assertArrayLength(result.visible, 2);
});

suite.test("Should handle multiple selected services (OR logic)", () => {
  const result = filterMovies(createMockState(), ["Disney Plus", "Netflix"]);
  assertArrayLength(result.visible, 3);
  assertArrayLength(result.hidden, 1);
});

const results = await suite.run();
process.exit(results.failed > 0 ? 1 : 0);
