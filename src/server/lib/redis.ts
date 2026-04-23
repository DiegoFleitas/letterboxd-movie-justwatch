import Redis from "ioredis";
import crypto from "crypto";

/** Minimal type for Redis client (ioredis default export can be awkward under TS). */
interface RedisClientLike {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  exists(...keys: string[]): Promise<number>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  quit(): Promise<void>;
  on(event: string, cb: (...args: unknown[]) => void): unknown;
}

let redisClient: RedisClientLike | null = null;
/** Set in tests via _injectRedisClientForTest. When undefined, use real client; when null, no client; when object, use as mock. */
let _testClient: RedisClientLike | null | undefined = undefined;

/** When true (e.g. CI), skip Redis entirely—local dev should leave this unset and use FLYIO_REDIS_URL. */
export const isRedisDisabled = (): boolean =>
  process.env.DISABLE_REDIS === "1" || process.env.DISABLE_REDIS === "true";

export const isHealthy = async (): Promise<boolean> => {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }
  try {
    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    console.log(`[REDIS_PING_ERROR] ${error}`);
    return false;
  }
};

const getRedisClient = async (): Promise<RedisClientLike | null> => {
  if (_testClient !== undefined) return _testClient;
  if (isRedisDisabled()) {
    return null;
  }
  if (!redisClient) {
    try {
      const url = process.env.FLYIO_REDIS_URL || "redis://localhost:6379";
      console.log("[REDIS_OPTIONS]", { url: url.replace(/:[^:@]+@/, ":***@") });
      const client = new (Redis as unknown as new (
        url: string,
        options?: { commandTimeout?: number; connectTimeout?: number },
      ) => RedisClientLike)(url, {
        commandTimeout: 10_000,
        connectTimeout: 10_000,
      });
      client.on("error", (...args: unknown[]) => {
        const error = args[0] as Error;
        console.log(`[REDIS_CLIENT_ERROR] ${error}`);
        throw error;
      });
      client.on("connect", () => {
        console.log("Connected to Redis");
      });
      redisClient = client;
    } catch (error) {
      console.error(error);
    }
  }
  return redisClient;
};

export const getCacheValue = async (key: string): Promise<unknown> => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const hashedKey = getCacheKey(key);
    const value = await client.get(hashedKey);
    if (!value) {
      console.log(`[REDIS_MISS] ${hashedKey} (${key})`);
    } else {
      console.log(`[REDIS_HIT] ${hashedKey} (${key})`);
    }
    try {
      return value !== null ? JSON.parse(value) : value;
    } catch {
      console.log(`[REDIS_INVALID_JSON] ${hashedKey} (${key})`);
      return null;
    }
  } catch (error) {
    console.log(`[REDIS_GET_ERROR] (${key}) ${error}`);
    return null;
  }
};

export const setCacheValue = async (
  key: string,
  value: unknown,
  ttl: number = 60,
  category: string | string[] | null = null,
): Promise<boolean | null> => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const serializedValue = JSON.stringify(value);
    const hashedKey = getCacheKey(key);
    const result = await client.set(hashedKey, serializedValue, "EX", ttl);
    console.log(`[REDIS_SET] ${hashedKey} (${key}) TTL: ${ttl}`);

    if (result === "OK" && category) {
      const categories = Array.isArray(category) ? category : [category];
      for (const categoryName of categories) {
        const indexKey = `${process.env.FLY_APP_NAME || "app"}:keys:${categoryName}`;
        await client.sadd(indexKey, hashedKey);
      }
    }
    return result === "OK";
  } catch (error) {
    console.log(`[REDIS_SET_ERROR] (${key}) ${error}`);
    return null;
  }
};

export const indexCacheKeyByCategory = async (
  key: string,
  category: string | string[],
): Promise<boolean> => {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }
  try {
    const hashedKey = getCacheKey(key);
    const categories = Array.isArray(category) ? category : [category];
    for (const categoryName of categories) {
      const indexKey = `${process.env.FLY_APP_NAME || "app"}:keys:${categoryName}`;
      await client.sadd(indexKey, hashedKey);
    }
    return true;
  } catch (error) {
    console.log(`[REDIS_INDEX_ERROR] (${key}) ${error}`);
    return false;
  }
};

export const clearCacheByCategory = async (
  category: string,
): Promise<{ cleared: number; error?: string }> => {
  const client = await getRedisClient();
  if (!client) {
    return { cleared: 0, error: "Redis unavailable" };
  }
  const indexKey = `${process.env.FLY_APP_NAME || "app"}:keys:${category}`;
  try {
    const keys = await client.smembers(indexKey);
    if (keys.length === 0) {
      return { cleared: 0 };
    }
    await client.del(...keys);
    await client.del(indexKey);
    console.log(`[REDIS_CLEAR] ${category}: ${keys.length} keys`);
    return { cleared: keys.length };
  } catch (error) {
    const err = error as Error;
    console.log(`[REDIS_CLEAR_ERROR] (${category}) ${error}`);
    return { cleared: 0, error: err.message };
  }
};

export const getCacheCategoryCount = async (
  category: string,
): Promise<{ count: number; error?: string }> => {
  const client = await getRedisClient();
  if (!client) {
    return { count: 0, error: "Redis unavailable" };
  }
  const indexKey = `${process.env.FLY_APP_NAME || "app"}:keys:${category}`;
  try {
    const keys = await client.smembers(indexKey);
    if (keys.length === 0) {
      return { count: 0 };
    }
    const presentMask = await Promise.all(keys.map((key) => client.exists(key)));
    const staleKeys = keys.filter((_, index) => presentMask[index] === 0);
    if (staleKeys.length > 0) {
      await client.srem(indexKey, ...staleKeys);
    }
    return { count: keys.length - staleKeys.length };
  } catch (error) {
    const err = error as Error;
    console.log(`[REDIS_COUNT_ERROR] (${category}) ${error}`);
    return { count: 0, error: err.message };
  }
};

function isLikelySearchMovieCacheJson(value: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.movieProviders)) return true;

  if (typeof obj.error === "string") {
    const e = obj.error;
    return (
      e.includes("Movie not found") ||
      e.includes("JustWatch") ||
      e.includes("streaming services") ||
      e.includes("Alternative search")
    );
  }

  if (obj.message === "Movie found") return true;
  return false;
}

/**
 * Dev/diagnostic estimate: count Redis STRING keys under the app prefix whose JSON payload looks like
 * `/api/search-movie` cache entries.
 *
 * Note: this intentionally avoids relying on the category index sets (those can be missing/stale).
 */
export const estimateSearchMovieStringKeyCount = async (): Promise<{
  approxSearchMovieStringKeys: number;
  scannedStringKeys: number;
  error?: string;
}> => {
  if (isRedisDisabled()) {
    return { approxSearchMovieStringKeys: 0, scannedStringKeys: 0, error: "Redis unavailable" };
  }

  const url = process.env.FLYIO_REDIS_URL || "redis://localhost:6379";
  const prefix = `${process.env.FLY_APP_NAME || "app"}:`;

  // Use a dedicated short-lived client for SCAN (doesn't affect the pooled app client).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scanClient = new (Redis as any)(url, { maxRetriesPerRequest: 1 });

  let approxSearchMovieStringKeys = 0;
  let scannedStringKeys = 0;

  try {
    const stream = scanClient.scanStream({ match: `${prefix}*`, count: 200 });
    const keys: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (keyList: string[]) => keys.push(...keyList));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    for (const key of keys) {
      const t = await scanClient.type(key);
      if (t !== "string") continue;
      scannedStringKeys++;

      // Skip category index sets stored as strings (shouldn't happen) and any obvious index keys.
      if (key.includes(":keys:")) continue;

      const pttl = await scanClient.pttl(key);
      if (pttl === -2) continue;

      const value = await scanClient.get(key);
      if (value == null) continue;
      if (isLikelySearchMovieCacheJson(value)) approxSearchMovieStringKeys++;
    }

    return { approxSearchMovieStringKeys, scannedStringKeys };
  } catch (error) {
    const err = error as Error;
    console.log(`[REDIS_SEARCH_MOVIE_SCAN_ERROR] ${error}`);
    return { approxSearchMovieStringKeys: 0, scannedStringKeys: 0, error: err.message };
  } finally {
    await scanClient.quit();
  }
};

const getCacheKey = (str: string): string => {
  const hash = crypto.createHash("sha256");
  hash.update(str);
  return `${process.env.FLY_APP_NAME || "app"}:${hash.digest("hex")}`;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("Redis connection closed");
  }
};

export const _resetRedisForTesting = (): void => {
  redisClient = null;
  _testClient = undefined;
};

export const _injectRedisClientForTest = (client: RedisClientLike | null): void => {
  _testClient = client;
};
