import redis from "redis";
import crypto from "crypto";

let redisClient = null;

const isHealthy = async () => {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }
  try {
    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    console.log(error);
    return false;
  }
};

// create a Redis client instance if it doesn't exist, or return the existing one
const getRedisClient = async () => {
  if (!redisClient) {
    try {
      const options = {
        url: process.env.FLYIO_REDIS_URL || "redis://localhost:6379",
      };
      console.log(options);
      redisClient = redis
        .createClient(options)
        .on("error", (err) => {
          console.log("Redis connection error", err);
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
const getCacheValue = async (key) => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const hashedKey = getCacheKey(key);
    const value = await client.get(hashedKey);
    console.log(
      `[${new Date().toISOString()}] Get cache value for key ${hashedKey} (${key})`
    );
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  } catch (error) {
    console.log(
      `[${new Date().toISOString()}] Error getting cache value for key (${key})`
    );
    console.log(error);
    return null;
  }
};

// set a value in Redis cache with a TTL (time-to-live) in minutes
const setCacheValue = async (key, value, ttl = 60) => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const serializedValue = JSON.stringify(value);
    const hashedKey = getCacheKey(key);
    const result = await client.set(hashedKey, serializedValue, { EX: ttl });
    console.log(
      `[${new Date().toISOString()}] Set cache value for key ${hashedKey} (${key}) with TTL ${ttl} min`
    );
    return result === "OK";
  } catch (error) {
    console.log(
      `[${new Date().toISOString()}] Error setting cache value for key (${key}) with TTL ${ttl} min`
    );
    console.log(error);
  }
};

const getCacheKey = (str) => {
  const hash = crypto.createHash("sha256");
  hash.update(str);
  // since upstash is shared, we need to namespace the keys
  return `${process.env.FLY_APP_NAME}:${hash.digest("hex")}`;
};

export { getCacheValue, setCacheValue, isHealthy };
