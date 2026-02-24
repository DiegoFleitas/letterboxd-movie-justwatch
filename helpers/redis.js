import Redis from "ioredis";
import crypto from "crypto";

let redisClient = null;
/** Set in tests via _injectRedisClientForTest. When undefined, use real client; when null, no client; when object, use as mock. */
let _testClient = undefined;

export const isHealthy = async () => {
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

// create a Redis client instance if it doesn't exist, or return the existing one
const getRedisClient = async () => {
  if (_testClient !== undefined) return _testClient;
  if (!redisClient) {
    try {
      const url = process.env.FLYIO_REDIS_URL || "redis://localhost:6379";
      console.log("[REDIS_OPTIONS]", { url: url.replace(/:[^:@]+@/, ":***@") });
      redisClient = new Redis(url)
        .on("error", (error) => {
          console.log(`[REDIS_CLIENT_ERROR] ${error}`);
          throw error;
        })
        .on("connect", () => {
          console.log("Connected to Redis");
        });
    } catch (error) {
      console.error(error);
    }
  }
  return redisClient;
};

// get a value from Redis cache
export const getCacheValue = async (key) => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const hashedKey = getCacheKey(key);
    const value = await client.get(hashedKey);
    !value
      ? console.log(`[REDIS_MISS] ${hashedKey} (${key})`)
      : console.log(`[REDIS_HIT] ${hashedKey} (${key})`);
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  } catch (error) {
    console.log(`[REDIS_GET_ERROR] (${key}) ${error}`);
    return null;
  }
};

// set a value in Redis cache with a TTL (time-to-live) in seconds
// category: if set (e.g. "list"), key is added to an index so clearCacheByCategory can clear it
export const setCacheValue = async (key, value, ttl = 60, category = null) => {
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
      const indexKey = `${process.env.FLY_APP_NAME || "app"}:keys:${category}`;
      await client.sadd(indexKey, hashedKey);
    }
    return result === "OK";
  } catch (error) {
    console.log(`[REDIS_SET_ERROR] (${key}) ${error}`);
  }
};

/** Remove all keys in a category (e.g. "list"). Only keys set with that category after deploy are cleared. */
export const clearCacheByCategory = async (category) => {
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
    console.log(`[REDIS_CLEAR_ERROR] (${category}) ${error}`);
    return { cleared: 0, error: error.message };
  }
};

const getCacheKey = (str) => {
  const hash = crypto.createHash("sha256");
  hash.update(str);
  // since upstash is shared, we need to namespace the keys
  return `${process.env.FLY_APP_NAME || "app"}:${hash.digest("hex")}`;
};

/** Graceful shutdown: close the Redis connection. Call from server shutdown. */
export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("Redis connection closed");
  }
};

/** For tests only: clear singleton and injected client so next call creates a fresh client (or test can inject mock). */
export const _resetRedisForTesting = () => {
  redisClient = null;
  _testClient = undefined;
};

/** For tests only: inject a mock Redis client; getRedisClient() will return it until reset. */
export const _injectRedisClientForTest = (client) => {
  _testClient = client;
};
