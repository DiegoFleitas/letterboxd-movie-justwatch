import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { createServer } from "../server/createServer.js";
import { _injectRedisClientForTest, _resetRedisForTesting } from "../helpers/redis.js";

/** In-memory Redis so CI does not need a real server (matches RedisClientLike in helpers/redis). */
function createInMemoryRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    ping: () => Promise.resolve("PONG"),
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    },
    del: (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n++;
        for (const s of sets.values()) s.delete(k);
      }
      return Promise.resolve(n);
    },
    sadd: (key: string, ...members: string[]) => {
      let s = sets.get(key);
      if (!s) {
        s = new Set();
        sets.set(key, s);
      }
      let added = 0;
      for (const m of members) {
        if (!s.has(m)) {
          s.add(m);
          added++;
        }
      }
      return Promise.resolve(added);
    },
    smembers: (key: string) => Promise.resolve([...(sets.get(key) ?? [])]),
    quit: () => Promise.resolve(undefined as void),
    on: () => {},
  };
}

describe("backend integration (fastify)", () => {
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

  it.skipIf(!process.env.MOVIE_DB_API_KEY)(
    "POST /api/search-movie responds with JSON shape",
    async () => {
      const res = await fetch(`${baseUrl}/api/search-movie`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
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
