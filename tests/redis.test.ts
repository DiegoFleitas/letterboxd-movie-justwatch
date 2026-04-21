/**
 * Unit tests for Redis cache helper
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCacheValue,
  setCacheValue,
  clearCacheByCategory,
  isHealthy,
  disconnectRedis,
  _resetRedisForTesting,
  _injectRedisClientForTest,
} from "../lib/redis.js";

function createMockClient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const calls = {
    get: [] as unknown[][],
    set: [] as unknown[][],
    sadd: [] as unknown[][],
    smembers: [] as unknown[][],
    del: [] as unknown[][],
    ping: [] as unknown[][],
  };
  const defaultSmembers = (key: string) => {
    calls.smembers.push([key]);
    const ret = Array.isArray(overrides.smembers)
      ? overrides.smembers
      : ((overrides.smembers as string[]) ?? []);
    return Promise.resolve(ret);
  };
  return {
    ping: () =>
      typeof overrides.ping === "function"
        ? (overrides.ping as () => Promise<string>)()
        : Promise.resolve("PONG"),
    get: (key: string) => {
      const ret =
        typeof overrides.get === "function"
          ? (overrides.get as (k: string) => unknown)(key)
          : (overrides.get ?? null);
      return Promise.resolve(ret);
    },
    set: (...args: unknown[]) => {
      calls.set.push(args);
      return Promise.resolve(overrides.set ?? "OK");
    },
    sadd: (...args: unknown[]) => {
      calls.sadd.push(args);
      return Promise.resolve(1);
    },
    smembers:
      overrides.smembers && typeof overrides.smembers === "function"
        ? (key: string) => {
            calls.smembers.push([key]);
            return (overrides.smembers as (k: string) => Promise<string[]>)(key);
          }
        : defaultSmembers,
    del: (...args: unknown[]) => {
      calls.del.push(args);
      return Promise.resolve(args.length);
    },
    quit: () => Promise.resolve("OK"),
    _calls: calls,
  };
}

describe("Redis cache", () => {
  beforeEach(() => {
    _resetRedisForTesting();
  });

  afterEach(() => {
    _resetRedisForTesting();
  });

  it("isHealthy returns false when client is null", async () => {
    _injectRedisClientForTest(null);
    expect(await isHealthy()).toBe(false);
  });

  it("isHealthy returns false when ping throws", async () => {
    const mock = createMockClient({ ping: () => Promise.reject(new Error("connection lost")) });
    _injectRedisClientForTest(mock as never);
    expect(await isHealthy()).toBe(false);
  });

  it("isHealthy returns true when ping returns PONG", async () => {
    const mock = createMockClient();
    _injectRedisClientForTest(mock as never);
    expect(await isHealthy()).toBe(true);
  });

  it("getCacheValue returns null when client is null", async () => {
    _injectRedisClientForTest(null);
    expect(await getCacheValue("anykey")).toBeNull();
  });

  it("getCacheValue returns null when get returns null", async () => {
    const mock = createMockClient({ get: () => Promise.resolve(null) });
    _injectRedisClientForTest(mock as never);
    expect(await getCacheValue("missing")).toBeNull();
  });

  it("getCacheValue returns parsed JSON when get returns string", async () => {
    const data = { title: "Inception", year: 2010 };
    const mock = createMockClient({ get: () => Promise.resolve(JSON.stringify(data)) });
    _injectRedisClientForTest(mock as never);
    expect(await getCacheValue("somekey")).toEqual(data);
  });

  it("getCacheValue returns null when get throws", async () => {
    const mock = createMockClient({ get: () => Promise.reject(new Error("timeout")) });
    _injectRedisClientForTest(mock as never);
    expect(await getCacheValue("key")).toBeNull();
  });

  it("setCacheValue returns null when client is null", async () => {
    _injectRedisClientForTest(null);
    expect(await setCacheValue("k", "v", 60)).toBeNull();
  });

  it("setCacheValue calls set with EX and ttl and returns true", async () => {
    const mock = createMockClient() as ReturnType<typeof createMockClient> & {
      _calls: { set: unknown[][] };
    };
    _injectRedisClientForTest(mock as never);
    const result = await setCacheValue("mykey", { x: 1 }, 120);
    expect(result).toBe(true);
    expect(mock._calls.set).toHaveLength(1);
    const [key, value, mode, ttl] = mock._calls.set[0];
    expect(mode).toBe("EX");
    expect(ttl).toBe(120);
    expect(value).toBe('{"x":1}');
    expect(
      typeof key === "string" && (key as string).startsWith("app:") && (key as string).length > 40,
    ).toBe(true);
  });

  it("setCacheValue with category calls sadd with index key", async () => {
    const mock = createMockClient() as ReturnType<typeof createMockClient> & {
      _calls: { sadd: unknown[][] };
    };
    _injectRedisClientForTest(mock as never);
    await setCacheValue("foo", "bar", 60, "list");
    expect(mock._calls.sadd).toHaveLength(1);
    const [indexKey] = mock._calls.sadd[0];
    expect(indexKey).toBe("app:keys:list");
  });

  it("setCacheValue uses FLY_APP_NAME in key and index when set", async () => {
    const saved = process.env.FLY_APP_NAME;
    process.env.FLY_APP_NAME = "movie-justwatch";
    const mock = createMockClient() as ReturnType<typeof createMockClient> & {
      _calls: { set: unknown[][]; sadd: unknown[][] };
    };
    _injectRedisClientForTest(mock as never);
    await setCacheValue("k", 1, 60, "list");
    expect((mock._calls.set[0][0] as string).startsWith("movie-justwatch:")).toBe(true);
    expect(mock._calls.sadd[0][0]).toBe("movie-justwatch:keys:list");
    if (saved !== undefined) process.env.FLY_APP_NAME = saved;
    else delete process.env.FLY_APP_NAME;
  });

  it("clearCacheByCategory returns error when client is null", async () => {
    _injectRedisClientForTest(null);
    expect(await clearCacheByCategory("list")).toEqual({
      cleared: 0,
      error: "Redis unavailable",
    });
  });

  it("clearCacheByCategory returns cleared 0 when smembers returns empty", async () => {
    const mock = createMockClient({ smembers: () => Promise.resolve([]) }) as ReturnType<
      typeof createMockClient
    > & { _calls: { del: unknown[] } };
    _injectRedisClientForTest(mock as never);
    expect(await clearCacheByCategory("list")).toEqual({ cleared: 0 });
    expect(mock._calls.del.length).toBe(0);
  });

  it("clearCacheByCategory deletes keys and index and returns cleared count", async () => {
    const saved = process.env.FLY_APP_NAME;
    delete process.env.FLY_APP_NAME;
    const keys = ["app:abc", "app:def"];
    const mock = createMockClient({ smembers: () => Promise.resolve(keys) }) as ReturnType<
      typeof createMockClient
    > & { _calls: { del: unknown[][] } };
    _injectRedisClientForTest(mock as never);
    expect(await clearCacheByCategory("list")).toEqual({ cleared: 2 });
    expect(mock._calls.del.length).toBe(2);
    expect(mock._calls.del[0]).toEqual(["app:abc", "app:def"]);
    expect(mock._calls.del[1]).toEqual(["app:keys:list"]);
    if (saved !== undefined) process.env.FLY_APP_NAME = saved;
  });

  it("clearCacheByCategory uses FLY_APP_NAME in index key", async () => {
    const saved = process.env.FLY_APP_NAME;
    process.env.FLY_APP_NAME = "myapp";
    const mock = createMockClient({ smembers: ["myapp:k1"] }) as ReturnType<
      typeof createMockClient
    > & { _calls: { smembers: unknown[][] } };
    _injectRedisClientForTest(mock as never);
    await clearCacheByCategory("search");
    expect(mock._calls.smembers[0][0]).toBe("myapp:keys:search");
    if (saved !== undefined) process.env.FLY_APP_NAME = saved;
    else delete process.env.FLY_APP_NAME;
  });

  it("disconnectRedis does not throw when client is null", async () => {
    await expect(disconnectRedis()).resolves.toBeUndefined();
  });

  it("_resetRedisForTesting clears injected client so isHealthy is false again", async () => {
    const mock = createMockClient();
    _injectRedisClientForTest(mock as never);
    expect(await isHealthy()).toBe(true);
    _resetRedisForTesting();
    _injectRedisClientForTest(null);
    expect(await isHealthy()).toBe(false);
  });

  describe("DISABLE_REDIS", () => {
    beforeEach(() => {
      vi.stubEnv("DISABLE_REDIS", "1");
      _resetRedisForTesting();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      _resetRedisForTesting();
    });

    it("skips Redis; getCacheValue returns null", async () => {
      expect(await getCacheValue("any-key")).toBe(null);
    });

    it("isHealthy is false without a client", async () => {
      expect(await isHealthy()).toBe(false);
    });
  });
});
