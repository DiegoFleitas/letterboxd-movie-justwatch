/**
 * Unit tests for Redis cache helper (ioredis wrapper: getCacheValue, setCacheValue, clearCacheByCategory, isHealthy, disconnectRedis)
 */
import { TestSuite, assertEqual, assertTruthy, assertFalsy, assertDeepEqual } from "./testUtils.js";
import {
  getCacheValue,
  setCacheValue,
  clearCacheByCategory,
  isHealthy,
  disconnectRedis,
  _resetRedisForTesting,
  _injectRedisClientForTest,
} from "../helpers/redis.js";

const suite = new TestSuite("Redis cache");

function createMockClient(overrides = {}) {
  const calls = { get: [], set: [], sadd: [], smembers: [], del: [], ping: [] };
  const defaultSmembers = (key) => {
    calls.smembers.push([key]);
    const ret = Array.isArray(overrides.smembers) ? overrides.smembers : (overrides.smembers ?? []);
    return Promise.resolve(ret);
  };
  return {
    ping: () => (typeof overrides.ping === "function" ? overrides.ping() : Promise.resolve("PONG")),
    get: (key) => {
      const ret = typeof overrides.get === "function" ? overrides.get(key) : Promise.resolve(overrides.get ?? null);
      return Promise.resolve(ret);
    },
    set: (...args) => {
      calls.set.push(args);
      return Promise.resolve(overrides.set ?? "OK");
    },
    sadd: (...args) => {
      calls.sadd.push(args);
      return Promise.resolve(1);
    },
    smembers: overrides.smembers && typeof overrides.smembers === "function"
      ? (key) => { calls.smembers.push([key]); return overrides.smembers(key); }
      : defaultSmembers,
    del: (...args) => {
      calls.del.push(args);
      return Promise.resolve(args.length);
    },
    quit: () => Promise.resolve("OK"),
    _calls: calls,
  };
}

suite.test("isHealthy returns false when client is null", async () => {
  _resetRedisForTesting();
  _injectRedisClientForTest(null);
  const result = await isHealthy();
  assertEqual(result, false);
});

suite.test("isHealthy returns false when ping throws", async () => {
  _resetRedisForTesting();
  const mock = createMockClient({ ping: () => Promise.reject(new Error("connection lost")) });
  _injectRedisClientForTest(mock);
  const result = await isHealthy();
  assertEqual(result, false);
  _resetRedisForTesting();
});

suite.test("isHealthy returns true when ping returns PONG", async () => {
  _resetRedisForTesting();
  const mock = createMockClient();
  _injectRedisClientForTest(mock);
  const result = await isHealthy();
  assertEqual(result, true);
  _resetRedisForTesting();
});

suite.test("getCacheValue returns null when client is null", async () => {
  _resetRedisForTesting();
  _injectRedisClientForTest(null);
  const result = await getCacheValue("anykey");
  assertEqual(result, null);
});

suite.test("getCacheValue returns null when get returns null", async () => {
  _resetRedisForTesting();
  const mock = createMockClient({ get: () => Promise.resolve(null) });
  _injectRedisClientForTest(mock);
  const result = await getCacheValue("missing");
  assertEqual(result, null);
  _resetRedisForTesting();
});

suite.test("getCacheValue returns parsed JSON when get returns string", async () => {
  _resetRedisForTesting();
  const data = { title: "Inception", year: 2010 };
  const mock = createMockClient({ get: () => Promise.resolve(JSON.stringify(data)) });
  _injectRedisClientForTest(mock);
  const result = await getCacheValue("somekey");
  assertDeepEqual(result, data);
  _resetRedisForTesting();
});

suite.test("getCacheValue returns null when get throws", async () => {
  _resetRedisForTesting();
  const mock = createMockClient({ get: () => Promise.reject(new Error("timeout")) });
  _injectRedisClientForTest(mock);
  const result = await getCacheValue("key");
  assertEqual(result, null);
  _resetRedisForTesting();
});

suite.test("setCacheValue returns null when client is null", async () => {
  _resetRedisForTesting();
  _injectRedisClientForTest(null);
  const result = await setCacheValue("k", "v", 60);
  assertEqual(result, null);
});

suite.test("setCacheValue calls set with EX and ttl and returns true", async () => {
  _resetRedisForTesting();
  const mock = createMockClient();
  _injectRedisClientForTest(mock);
  const result = await setCacheValue("mykey", { x: 1 }, 120);
  assertEqual(result, true);
  assertTruthy(mock._calls.set.length === 1);
  const [key, value, mode, ttl] = mock._calls.set[0];
  assertEqual(mode, "EX");
  assertEqual(ttl, 120);
  assertEqual(value, '{"x":1}');
  assertTruthy(key.startsWith("app:") && key.length > 40);
  _resetRedisForTesting();
});

suite.test("setCacheValue with category calls sadd with index key", async () => {
  _resetRedisForTesting();
  const mock = createMockClient();
  _injectRedisClientForTest(mock);
  await setCacheValue("foo", "bar", 60, "list");
  assertTruthy(mock._calls.sadd.length === 1);
  const [indexKey, hashedKey] = mock._calls.sadd[0];
  assertEqual(indexKey, "app:keys:list");
  assertTruthy(hashedKey.startsWith("app:"));
  _resetRedisForTesting();
});

suite.test("setCacheValue uses FLY_APP_NAME in key and index when set", async () => {
  _resetRedisForTesting();
  const saved = process.env.FLY_APP_NAME;
  process.env.FLY_APP_NAME = "movie-justwatch";
  const mock = createMockClient();
  _injectRedisClientForTest(mock);
  await setCacheValue("k", 1, 60, "list");
  assertTruthy(mock._calls.set[0][0].startsWith("movie-justwatch:"));
  assertEqual(mock._calls.sadd[0][0], "movie-justwatch:keys:list");
  process.env.FLY_APP_NAME = saved !== undefined ? saved : undefined;
  if (saved === undefined) delete process.env.FLY_APP_NAME;
  _resetRedisForTesting();
});

suite.test("clearCacheByCategory returns error when client is null", async () => {
  _resetRedisForTesting();
  _injectRedisClientForTest(null);
  const result = await clearCacheByCategory("list");
  assertDeepEqual(result, { cleared: 0, error: "Redis unavailable" });
});

suite.test("clearCacheByCategory returns cleared 0 when smembers returns empty", async () => {
  _resetRedisForTesting();
  const mock = createMockClient({ smembers: () => Promise.resolve([]) });
  _injectRedisClientForTest(mock);
  const result = await clearCacheByCategory("list");
  assertDeepEqual(result, { cleared: 0 });
  assertEqual(mock._calls.del.length, 0);
  _resetRedisForTesting();
});

suite.test("clearCacheByCategory deletes keys and index and returns cleared count", async () => {
  _resetRedisForTesting();
  const saved = process.env.FLY_APP_NAME;
  delete process.env.FLY_APP_NAME;
  const keys = ["app:abc", "app:def"];
  const mock = createMockClient({ smembers: () => Promise.resolve(keys) });
  _injectRedisClientForTest(mock);
  const result = await clearCacheByCategory("list");
  assertDeepEqual(result, { cleared: 2 });
  assertEqual(mock._calls.del.length, 2);
  assertDeepEqual(mock._calls.del[0], ["app:abc", "app:def"]);
  assertDeepEqual(mock._calls.del[1], ["app:keys:list"]);
  if (saved !== undefined) process.env.FLY_APP_NAME = saved;
  _resetRedisForTesting();
});

suite.test("clearCacheByCategory uses FLY_APP_NAME in index key", async () => {
  _resetRedisForTesting();
  const saved = process.env.FLY_APP_NAME;
  process.env.FLY_APP_NAME = "myapp";
  const mock = createMockClient({ smembers: ["myapp:k1"] });
  _injectRedisClientForTest(mock);
  await clearCacheByCategory("search");
  assertEqual(mock._calls.smembers[0][0], "myapp:keys:search");
  process.env.FLY_APP_NAME = saved !== undefined ? saved : undefined;
  if (saved === undefined) delete process.env.FLY_APP_NAME;
  _resetRedisForTesting();
});

suite.test("disconnectRedis does not throw when client is null", async () => {
  _resetRedisForTesting();
  await disconnectRedis();
});

suite.test("_resetRedisForTesting clears injected client so isHealthy is false again", async () => {
  _resetRedisForTesting();
  const mock = createMockClient();
  _injectRedisClientForTest(mock);
  assertTruthy(await isHealthy());
  _resetRedisForTesting();
  _injectRedisClientForTest(null);
  assertFalsy(await isHealthy());
});

const results = await suite.run();
const exitCode = results.failed > 0 ? 1 : 0;
process.exit(exitCode);
