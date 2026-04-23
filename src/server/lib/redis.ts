import Redis from "ioredis";
import crypto from "crypto";

/** ioredis pipeline batching (used to avoid N parallel round-trips for EXISTS/TYPE/GET). */
interface RedisPipelineLike {
  exists(key: string): RedisPipelineLike;
  type(key: string): RedisPipelineLike;
  pttl(key: string): RedisPipelineLike;
  get(key: string): RedisPipelineLike;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

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
  pipeline(): RedisPipelineLike;
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

const PTTL_CHUNK = 400;

/**
 * Earliest Redis key expiry among keys listed in the watchlist / list / search-movie category sets.
 * Keys with no TTL (PTTL -1) are ignored. Read-only (does not prune index sets).
 */
export const getSoonestIndexedCacheKeyExpiryAtMs = async (): Promise<{
  soonestExpiryAtMs: number | null;
  error?: string;
}> => {
  const client = await getRedisClient();
  if (!client) {
    return { soonestExpiryAtMs: null, error: "Redis unavailable" };
  }
  const app = process.env.FLY_APP_NAME || "app";
  const categories = ["watchlist", "list", "search-movie"] as const;
  try {
    const keySet = new Set<string>();
    for (const cat of categories) {
      const indexKey = `${app}:keys:${cat}`;
      const keys = await client.smembers(indexKey);
      for (const k of keys) {
        keySet.add(k);
      }
    }
    if (keySet.size === 0) {
      return { soonestExpiryAtMs: null };
    }
    const keys = [...keySet];
    let minPttlMs: number | null = null;
    for (let offset = 0; offset < keys.length; offset += PTTL_CHUNK) {
      const chunk = keys.slice(offset, offset + PTTL_CHUNK);
      const pipeline = client.pipeline();
      for (const key of chunk) {
        pipeline.pttl(key);
      }
      const execResult = await pipeline.exec();
      if (!execResult) continue;
      for (let i = 0; i < chunk.length; i++) {
        const row = execResult[i] as [Error | null, number] | undefined;
        if (!row) continue;
        const [pttlErr, pttl] = row;
        if (pttlErr) continue;
        if (pttl <= 0) continue;
        if (minPttlMs === null || pttl < minPttlMs) minPttlMs = pttl;
      }
    }
    if (minPttlMs === null) {
      return { soonestExpiryAtMs: null };
    }
    return { soonestExpiryAtMs: Date.now() + minPttlMs };
  } catch (error) {
    const err = error as Error;
    console.log(`[REDIS_SOONEST_TTL_ERROR] ${error}`);
    return { soonestExpiryAtMs: null, error: err.message };
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
    /** Batch EXISTS into pipelines so large category sets do not open N concurrent commands per poll. */
    const EXISTS_CHUNK = 400;
    const staleKeys: string[] = [];
    for (let offset = 0; offset < keys.length; offset += EXISTS_CHUNK) {
      const chunk = keys.slice(offset, offset + EXISTS_CHUNK);
      const pipeline = client.pipeline();
      for (const key of chunk) {
        pipeline.exists(key);
      }
      const execResult = await pipeline.exec();
      if (!execResult) continue;
      for (let i = 0; i < chunk.length; i++) {
        const tuple = execResult[i] as [Error | null, number] | undefined;
        if (!tuple) continue;
        const [existsErr, n] = tuple;
        if (existsErr || n === 0) {
          staleKeys.push(chunk[i]);
        }
      }
    }
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

type ScanStream = NodeJS.ReadableStream & {
  pause(): void;
  resume(): void;
  on(event: "data", listener: (keyList: string[]) => void): ScanStream;
  on(event: "end", listener: () => void): ScanStream;
  on(event: "error", listener: (err: Error) => void): ScanStream;
};

async function classifySearchMovieKeysFromScanChunk(
  scanClient: RedisClientLike,
  keyList: string[],
  counters: { scannedStringKeys: number; approxSearchMovieStringKeys: number },
): Promise<void> {
  if (keyList.length === 0) return;

  const typePipeline = scanClient.pipeline();
  for (const key of keyList) {
    typePipeline.type(key);
  }
  const typeRows = await typePipeline.exec();
  if (!typeRows) return;

  const candidateKeys: string[] = [];
  for (let i = 0; i < keyList.length; i++) {
    const key = keyList[i];
    const row = typeRows[i] as [Error | null, string] | undefined;
    if (!row) continue;
    const [typeErr, keyType] = row;
    if (typeErr || keyType !== "string") continue;
    counters.scannedStringKeys++;

    // Skip category index sets stored as strings (shouldn't happen) and any obvious index keys.
    if (key.includes(":keys:")) continue;
    candidateKeys.push(key);
  }

  if (candidateKeys.length === 0) return;

  const metaPipeline = scanClient.pipeline();
  for (const key of candidateKeys) {
    metaPipeline.pttl(key);
    metaPipeline.get(key);
  }
  const metaRows = await metaPipeline.exec();
  if (!metaRows) return;

  for (let i = 0; i < candidateKeys.length; i++) {
    const pttlRow = metaRows[i * 2] as [Error | null, number] | undefined;
    const getRow = metaRows[i * 2 + 1] as [Error | null, string | null] | undefined;
    if (!pttlRow || !getRow) continue;
    const [pttlErr, pttl] = pttlRow;
    if (pttlErr || pttl === -2) continue;
    const [getErr, value] = getRow;
    if (getErr || value == null || typeof value !== "string") continue;
    if (isLikelySearchMovieCacheJson(value)) counters.approxSearchMovieStringKeys++;
  }
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
  const scanClient = new (Redis as unknown as new (
    url: string,
    opts?: { maxRetriesPerRequest?: number },
  ) => RedisClientLike & { scanStream(opts: { match: string; count: number }): ScanStream })(url, {
    maxRetriesPerRequest: 1,
  });

  const counters = { scannedStringKeys: 0, approxSearchMovieStringKeys: 0 };

  try {
    const stream = scanClient.scanStream({ match: `${prefix}*`, count: 200 });
    let workChain = Promise.resolve();

    await new Promise<void>((resolve, reject) => {
      const fail = (err: unknown) => {
        reject(err);
      };

      stream.on("error", fail);
      stream.on("data", (keyList: string[]) => {
        stream.pause();
        workChain = workChain
          .then(() => classifySearchMovieKeysFromScanChunk(scanClient, keyList, counters))
          .then(() => {
            stream.resume();
          })
          .catch(fail);
      });
      stream.on("end", () => {
        void workChain.then(() => resolve()).catch(fail);
      });
    });

    return {
      approxSearchMovieStringKeys: counters.approxSearchMovieStringKeys,
      scannedStringKeys: counters.scannedStringKeys,
    };
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
