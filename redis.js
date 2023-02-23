const redis = require("redis");
const crypto = require("crypto");

require("dotenv").config();

let redisClient = null;

// create a Redis client instance if it doesn't exist, or return the existing one
const getRedisClient = async () => {
  if (!redisClient) {
    try {
      const options = {
        url: process.env.FLYIO_REDIS_URL,
      };
      console.log(options);
      redisClient = redis.createClient(options);
      await redisClient.connect();
    } catch (error) {
      console.log(error);
      throw error;
    }
  } else {
    try {
      await redisClient.ping();
    } catch (error) {
      redisClient = null;
      console.log("Redis connection lost", error);
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
      `[${new Date().toISOString()}] Error getting cache value for key ${hashedKey} (${key})`
    );
    console.log(error);
    return null;
  }
};

// set a value in Redis cache with a TTL (time-to-live) in seconds
const setCacheValue = async (key, value, ttl = 60) => {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const serializedValue = JSON.stringify(value);
    const hashedKey = getCacheKey(key);
    const result = await client.set(hashedKey, serializedValue, "EX", ttl);
    console.log(
      `[${new Date().toISOString()}] Set cache value for key ${hashedKey} (${key}) with TTL ${ttl} s`
    );
    return result === "OK";
  } catch (error) {
    console.log(
      `[${new Date().toISOString()}] Error setting cache value for key ${hashedKey} (${key}) with TTL ${ttl} s`
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

module.exports = { getCacheValue, setCacheValue };
