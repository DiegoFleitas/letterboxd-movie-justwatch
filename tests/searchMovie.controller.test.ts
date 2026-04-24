import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from "@server/httpStatusCodes.js";
import type { HttpHandlerArgs } from "@server/httpContext.js";

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@server/lib/axios.js", () => ({
  default: () => ({
    get: axiosMocks.get,
    post: axiosMocks.post,
  }),
}));

const redisMocks = vi.hoisted(() => ({
  getCacheValue: vi.fn(),
  setCacheValue: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@server/lib/redis.js", () => ({
  getCacheValue: (...args: unknown[]) => redisMocks.getCacheValue(...(args as [])),
  setCacheValue: (...args: unknown[]) => redisMocks.setCacheValue(...(args as [])),
}));

vi.mock("@server/lib/justWatchOutbound.js", () => ({
  recordJustWatchHttpAttempt: vi.fn(),
}));

function mockRes(): HttpHandlerArgs["res"] & { jsonMock: ReturnType<typeof vi.fn> } {
  const jsonMock = vi.fn();
  const self = {
    json: jsonMock,
    jsonMock,
    status(code: number) {
      self.statusCode = code;
      return self;
    },
    statusCode: undefined as number | undefined,
    send: vi.fn(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return self as HttpHandlerArgs["res"] & { jsonMock: ReturnType<typeof vi.fn> };
}

function ctx(
  body: unknown,
  appLocals: HttpHandlerArgs["req"]["appLocals"] = { canonicalProviderMap: {} },
): HttpHandlerArgs {
  const res = mockRes();
  return {
    req: {
      body,
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: "/api/search-movie",
      cookies: {},
      session: {},
      appLocals,
    },
    res,
  };
}

describe("searchMovie controller", () => {
  let searchMovie: (args: HttpHandlerArgs) => Promise<void>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("MOVIE_DB_API_KEY", "test-movie-db-key");
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
    redisMocks.getCacheValue.mockReset();
    redisMocks.setCacheValue.mockReset();
    redisMocks.setCacheValue.mockResolvedValue(true);
    ({ searchMovie } = await import("@server/controllers/searchMovie.js"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns movie not found when title is missing", async () => {
    const args = ctx({});
    await searchMovie(args);
    expect((args.res as ReturnType<typeof mockRes>).jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Movie not found" }),
    );
    expect(axiosMocks.get).not.toHaveBeenCalled();
  });

  it("returns cached object when Redis returns a cached payload", async () => {
    redisMocks.getCacheValue.mockResolvedValue({ message: "cached", title: "X" });
    const args = ctx({ title: "Inception", country: "en_US" });
    await searchMovie(args);
    expect((args.res as ReturnType<typeof mockRes>).jsonMock).toHaveBeenCalledWith({
      message: "cached",
      title: "X",
    });
    expect(axiosMocks.get).not.toHaveBeenCalled();
  });

  it("returns TMDB not found and caches when TMDB has no results", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({ data: { results: [] } });
    const args = ctx({ title: "NopeNopeNope", year: 1999, country: "en_US" });
    await searchMovie(args);
    expect((args.res as ReturnType<typeof mockRes>).jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Movie not found (TMDB)" }),
    );
    expect(redisMocks.setCacheValue).toHaveBeenCalled();
  });

  it("returns JustWatch unavailable when GraphQL post keeps failing", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const tmdbId = 27205;
    axiosMocks.get.mockResolvedValue({
      data: {
        results: [
          {
            id: tmdbId,
            title: "Inception",
            release_date: "2010-07-16",
            poster_path: "/poster.jpg",
          },
        ],
      },
    });
    axiosMocks.post.mockRejectedValue(new Error("network down"));
    const args = ctx({ title: "Inception", country: "en_US" });
    await searchMovie(args);
    expect((args.res as ReturnType<typeof mockRes>).jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "JustWatch API unavailable",
        title: "Inception",
      }),
    );
    expect(redisMocks.setCacheValue).toHaveBeenCalled();
  });

  it("returns not found in JustWatch when no edge matches TMDB id", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const tmdbId = 999;
    axiosMocks.get.mockResolvedValue({
      data: {
        results: [{ id: tmdbId, title: "Solo", release_date: "2018-01-01", poster_path: null }],
      },
    });
    axiosMocks.post.mockResolvedValue({
      data: {
        data: {
          popularTitles: {
            edges: [
              {
                node: {
                  content: {
                    fullPath: "/m/other",
                    title: "Other",
                    originalReleaseYear: 2018,
                    posterUrl: null,
                    externalIds: { tmdbId: 1, imdbId: "tt1" },
                  },
                  offers: [],
                },
              },
            ],
          },
        },
      },
    });
    const args = ctx({ title: "Solo", country: "en_US" });
    await searchMovie(args);
    expect((args.res as ReturnType<typeof mockRes>).jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Movie not found in JustWatch" }),
    );
  });

  it("returns no streaming services when offers array is empty", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const tmdbId = 42;
    axiosMocks.get.mockResolvedValue({
      data: {
        results: [{ id: tmdbId, title: "A", release_date: "2020-01-01", poster_path: "/p.jpg" }],
      },
    });
    axiosMocks.post.mockResolvedValue({
      data: {
        data: {
          popularTitles: {
            edges: [
              {
                node: {
                  content: {
                    fullPath: "/m/a",
                    title: "A",
                    originalReleaseYear: 2020,
                    posterUrl: "{profile}/x.{format}",
                    externalIds: { tmdbId, imdbId: "tt42" },
                  },
                  offers: [],
                },
              },
            ],
          },
        },
      },
    });
    const args = ctx({ title: "A", country: "en_US" });
    await searchMovie(args);
    const payload = (args.res as ReturnType<typeof mockRes>).jsonMock.mock.calls[0][0] as {
      error?: string;
    };
    expect(payload.error).toContain("No streaming services");
  });

  it("returns no streaming services when offers exist but none are streamable types", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const tmdbId = 43;
    axiosMocks.get.mockResolvedValue({
      data: {
        results: [{ id: tmdbId, title: "B", release_date: "2021-01-01", poster_path: null }],
      },
    });
    axiosMocks.post.mockResolvedValue({
      data: {
        data: {
          popularTitles: {
            edges: [
              {
                node: {
                  content: {
                    fullPath: "/m/b",
                    title: "B",
                    originalReleaseYear: 2021,
                    posterUrl: null,
                    externalIds: { tmdbId, imdbId: "tt43" },
                  },
                  offers: [
                    {
                      monetizationType: "RENT",
                      standardWebURL: "https://example.com/rent",
                      package: {
                        clearName: "RentCo",
                        technicalName: "rentco",
                        icon: "{profile}/i.{format}",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });
    const args = ctx({ title: "B", country: "en_US" });
    await searchMovie(args);
    const payload = (args.res as ReturnType<typeof mockRes>).jsonMock.mock.calls[0][0] as {
      error?: string;
    };
    expect(payload.error).toContain("No streaming services");
  });

  it("returns success with movieProviders on happy path", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const tmdbId = 100;
    axiosMocks.get.mockResolvedValue({
      data: {
        results: [
          { id: tmdbId, title: "Happy", release_date: "2019-06-01", poster_path: "/h.jpg" },
        ],
      },
    });
    axiosMocks.post.mockResolvedValue({
      data: {
        data: {
          popularTitles: {
            edges: [
              {
                node: {
                  content: {
                    fullPath: "/m/happy",
                    title: "Happy",
                    originalReleaseYear: 2019,
                    posterUrl: "{profile}/jw.{format}",
                    externalIds: { tmdbId, imdbId: "tt100" },
                  },
                  offers: [
                    {
                      monetizationType: "FLATRATE",
                      standardWebURL: "https://play.example/h",
                      package: {
                        clearName: "StreamCo",
                        technicalName: "streamco",
                        icon: "{profile}/ico.{format}",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });
    const args = ctx({ title: "Happy", country: "en_US" });
    await searchMovie(args);
    expect((args.res as ReturnType<typeof mockRes>).jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Movie found",
        movieProviders: expect.any(Array),
        title: "Happy",
      }),
    );
    const body = (args.res as ReturnType<typeof mockRes>).jsonMock.mock.calls[0][0] as {
      movieProviders: unknown[];
    };
    expect(body.movieProviders.length).toBeGreaterThan(0);
  });

  it("returns 500 when TMDB get throws", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockRejectedValue(new Error("TMDB boom"));
    const args = ctx({ title: "Crash", country: "en_US" });
    const r = args.res as ReturnType<typeof mockRes>;
    await searchMovie(args);
    expect(r.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Internal Server Error" }),
    );
  });
});
