import Fastify from "fastify";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerDevHttpRoutes } from "@server/registerDevHttpRoutes.js";

vi.mock("@server/lib/redis.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/lib/redis.js")>();
  return {
    ...actual,
    getCacheCategoryCount: vi.fn().mockImplementation(async (cat: string) => {
      if (cat === "watchlist") return { count: 2 };
      if (cat === "list") return { count: 1 };
      if (cat === "search-movie") return { count: 4 };
      return { count: 0 };
    }),
    estimateSearchMovieStringKeyCount: vi.fn().mockResolvedValue({
      approxSearchMovieStringKeys: 6,
      scannedStringKeys: 100,
    }),
    getSoonestIndexedCacheKeyExpiryAtMs: vi.fn().mockResolvedValue({
      soonestExpiryAtMs: Date.now() + 60_000,
    }),
  };
});

describe("registerDevHttpRoutes cache-status", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DISABLE_REDIS", "");
    vi.stubEnv("FLYIO_REDIS_URL", "redis://localhost:6379");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("GET /api/dev/cache-status returns aggregated cache fields", async () => {
    const app = Fastify({ logger: false });
    registerDevHttpRoutes(app);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/dev/cache-status" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      ok: boolean;
      watchlistCacheEntries: number;
      searchMovieApproxStringKeys: number | null;
      justWatchHttpErrors: { total: number };
    };
    expect(body.ok).toBe(true);
    expect(body.watchlistCacheEntries).toBe(2);
    expect(body.searchMovieApproxStringKeys).toBeNull();
    expect(body.justWatchHttpErrors.total).toBeTypeOf("number");
    await app.close();
  });

  it("GET /api/dev/cache-status?scan=1 includes scan fields", async () => {
    const app = Fastify({ logger: false });
    registerDevHttpRoutes(app);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/dev/cache-status?scan=1" });
    const body = JSON.parse(res.body) as { searchMovieScannedStringKeys: number | null };
    expect(res.statusCode).toBe(200);
    expect(body.searchMovieScannedStringKeys).toBe(100);
    await app.close();
  });
});
