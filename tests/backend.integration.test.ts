import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { HTTP_API_PATHS } from "@server/routes.js";
import { createServer } from "@server/createServer.js";
import { _injectRedisClientForTest, _resetRedisForTesting } from "@server/lib/redis.js";
import { createInMemoryRedisMock } from "./helpers/inMemoryRedisMock.js";

describe("backend integration (fastify)", () => {
  let baseUrl: string;
  let closeServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    _injectRedisClientForTest(createInMemoryRedisMock() as never);
    const created = await createServer();
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

  it("GET /healthcheck returns OK", async () => {
    const res = await fetch(`${baseUrl}/healthcheck`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(text).toBe("OK");
  });

  it("GET /redis-healthcheck returns OK with mocked Redis", async () => {
    const res = await fetch(`${baseUrl}/redis-healthcheck`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(text).toBe("OK");
  });

  it("POST /api/search-movie without title returns validation error (400)", async () => {
    const res = await fetch(`${baseUrl}${HTTP_API_PATHS.searchMovie}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-requested-by": "MovieJustWatch",
      },
      body: JSON.stringify({}),
    });

    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body).toMatchObject({ error: "Title is required" });
  });

  it("POST /api/search-movie without CSRF header is rejected (400)", async () => {
    const res = await fetch(`${baseUrl}${HTTP_API_PATHS.searchMovie}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Inception" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Bad Request");
  });

  it.each([undefined, "gzip", "br", "zstd", "gzip, deflate, br, zstd"])(
    "GET / with Accept-Encoding=%s returns non-empty HTML",
    async (encoding) => {
      const headers: Record<string, string> = {};
      if (encoding) {
        headers["accept-encoding"] = encoding;
      }
      const res = await fetch(`${baseUrl}/`, { headers });
      const text = await res.text();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain("</html>");
    },
  );

  it("GET /api/sentry-test?mode=response returns JSON error without throwing", async () => {
    const res = await fetch(`${baseUrl}${HTTP_API_PATHS.sentryTest}?mode=response`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("Sentry");
  });

  it.skipIf(!process.env.MOVIE_DB_API_KEY)(
    "POST /api/search-movie responds with JSON shape",
    async () => {
      const res = await fetch(`${baseUrl}${HTTP_API_PATHS.searchMovie}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-requested-by": "MovieJustWatch",
        },
        body: JSON.stringify({
          title: "Inception",
          country: "US",
        }),
      });

      expect(res.status).toBe(200);
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("application/json");

      const body = await res.json();

      expect(body).toBeTypeOf("object");
      expect(body).toHaveProperty("title");
      expect(typeof (body as { title: unknown }).title).toBe("string");
    },
  );
});

describe("backend integration (DISABLE_REDIS)", () => {
  let baseUrl: string;
  let closeServer: (() => Promise<void>) | null = null;
  const prevDisableRedis = process.env.DISABLE_REDIS;

  beforeAll(async () => {
    _resetRedisForTesting();
    process.env.DISABLE_REDIS = "1";
    const created = await createServer();
    const { port, close } = await created.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
    closeServer = close;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = null;
    }
    if (prevDisableRedis === undefined) {
      delete process.env.DISABLE_REDIS;
    } else {
      process.env.DISABLE_REDIS = prevDisableRedis;
    }
  });

  it("GET /redis-healthcheck returns OK (Redis disabled)", async () => {
    const res = await fetch(`${baseUrl}/redis-healthcheck`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toBe("OK (Redis disabled)");
  });
});

describe("backend integration (Redis unhealthy)", () => {
  let baseUrl: string;
  let closeServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    _injectRedisClientForTest({
      ping: () => Promise.resolve("NOT_PONG"),
      get: () => Promise.resolve(null),
      set: () => Promise.resolve("OK"),
      del: () => Promise.resolve(0),
      sadd: () => Promise.resolve(0),
      smembers: () => Promise.resolve([]),
      exists: () => Promise.resolve(0),
      pipeline() {
        const chain = {
          exists() {
            return chain;
          },
          type() {
            return chain;
          },
          pttl() {
            return chain;
          },
          get() {
            return chain;
          },
          exec: async () => [],
        };
        return chain;
      },
      quit: () => Promise.resolve(undefined as void),
      on: () => {},
    } as never);
    const created = await createServer();
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

  it("GET /redis-healthcheck returns 500 when ping is unhealthy", async () => {
    const res = await fetch(`${baseUrl}/redis-healthcheck`);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).toBe("Redis is not healthy");
  });
});
