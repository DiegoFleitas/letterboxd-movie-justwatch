import { describe, it, expect } from "vitest";

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
  selectedServices: string[],
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

describe("filterMovies", () => {
  it("hides movies with no providers when filter is active", () => {
    const result = filterMovies(createMockState(), ["Disney Plus"]);
    expect(result.hidden).toContain("2018-MOVIE1");
  });

  it("shows movies with matching provider", () => {
    const result = filterMovies(createMockState(), ["Disney Plus"]);
    expect(result.visible).toEqual(expect.arrayContaining(["2024-MOVIE2", "2020-MOVIE3"]));
  });

  it("hides movies without matching provider", () => {
    const result = filterMovies(createMockState(), ["Disney Plus"]);
    expect(result.hidden).toContain("1990-MOVIE4");
  });

  it("returns correct counts when filtering by Disney Plus", () => {
    const result = filterMovies(createMockState(), ["Disney Plus"]);
    expect(result.visible).toHaveLength(2);
    expect(result.hidden).toHaveLength(2);
  });

  it("returns correct movies when filtering by Netflix", () => {
    const result = filterMovies(createMockState(), ["Netflix"]);
    expect(result.visible).toEqual(expect.arrayContaining(["2020-MOVIE3", "1990-MOVIE4"]));
    expect(result.visible).toHaveLength(2);
  });

  it("handles multiple selected services (OR logic)", () => {
    const result = filterMovies(createMockState(), ["Disney Plus", "Netflix"]);
    expect(result.visible).toHaveLength(3);
    expect(result.hidden).toHaveLength(1);
  });
});
