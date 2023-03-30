import redis from "redis";
import crypto from "crypto";

let redisClient = null;

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
  if (!redisClient) {
    try {
      const options = {
        url: process.env.FLYIO_REDIS_URL || "redis://localhost:6379",
        disableOfflineQueue: true, // reject commands when client is reconnecting
        poolOptions: {
          max: 100,
          min: 5,
          maxWaitingClients: 50,
          testOnBorrow: true,
          acquireTimeoutMillis: 10000, // 10 seconds
        },
      };
      console.log(options);
      redisClient = redis
        .createClient(options)
        .on("error", (err) => {
          console.log(`[REDIS_CLIENT_ERROR] ${error}`);
        })
        .on("connect", () => {
          console.log("Connected to Redis");
        });
      await redisClient.connect();
    } catch (error) {
      console.log(error);
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

// set a value in Redis cache with a TTL (time-to-live) in minutes
export const setCacheValue = async (key, value, ttl = 60) => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const serializedValue = JSON.stringify(value);
    const hashedKey = getCacheKey(key);
    const result = await client.set(hashedKey, serializedValue, { EX: ttl });
    console.log(`[REDIS_SET] ${hashedKey} (${key}) TTL: ${ttl}`);

    return result === "OK";
  } catch (error) {
    console.log(`[REDIS_SET_ERROR] (${key}) ${error}`);
  }
};

const getCacheKey = (str) => {
  const hash = crypto.createHash("sha256");
  hash.update(str);
  // since upstash is shared, we need to namespace the keys
  return `${process.env.FLY_APP_NAME}:${hash.digest("hex")}`;
};
