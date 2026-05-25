import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "@server/createServer.js";
import { _injectRedisClientForTest, _resetRedisForTesting } from "@server/lib/redis.js";
import { createInMemoryRedisMock } from "./helpers/inMemoryRedisMock.js";

interface TestMovie {
  title: string;
  year: string | null;
}

const TEST_MOVIES: TestMovie[] = [
  { title: "The Little Drummer Girl", year: "2018" },
  { title: "Her Private Hell", year: null },
  { title: "Shoplifters", year: "2018" },
  { title: "Lake Mungo", year: "2008" },
  { title: "Nikita", year: "1990" },
  { title: "Ghost World", year: "2001" },
];

describe("poster flow", () => {
  let baseUrl: string;
  let closeServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    _injectRedisClientForTest(createInMemoryRedisMock() as never);
    const created = createServer();
    const { port, close } = await created.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
    closeServer = close;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = null;
    }
    _resetRedisForTesting();
  });

  const hasApiKey = !!process.env.MOVIE_DB_API_KEY;

  describe.each(TEST_MOVIES)("$title", ({ title, year }) => {
    it.skipIf(!hasApiKey)("returns poster and providers", async () => {
      const res = await fetch(`${baseUrl}/api/search-movie`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, year, country: "es_UY" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = (await res.json()) as {
        poster?: string;
        title?: string;
        year?: string | number;
        movieProviders?: unknown[];
        error?: string;
      };

      expect(body).toHaveProperty("title");
      expect(body).toHaveProperty("poster");
      expect(body).toHaveProperty("movieProviders");
    });
  });

  it.skipIf(!hasApiKey)("at least one movie has a poster", async () => {
    const results: Array<{ hasPoster: boolean }> = [];

    for (const movie of TEST_MOVIES) {
      const res = await fetch(`${baseUrl}/api/search-movie`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: movie.title, year: movie.year, country: "es_UY" }),
      });

      if (res.ok) {
        const body = (await res.json()) as { poster?: string };
        results.push({ hasPoster: !!body.poster });
      }
    }

    const withPosters = results.filter((r) => r.hasPoster).length;
    expect(withPosters).toBeGreaterThan(0);
  });
});
