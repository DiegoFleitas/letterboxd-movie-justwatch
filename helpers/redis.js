const crypto = require("crypto");
const redisConnectionPoolFactory = require("redis-connection-pool").default;

require("dotenv").config();

const REDIS_POOL_NAME = "default";

const redisConfig = {
  url: process.env.FLYIO_REDIS_URL || "redis://localhost:6379",
  max_clients: 25,
  perform_checks: true,
  database: 0,
};

let pool;

// use connection pool instead of creating a new redisPool for each request (performance)
if (!pool) {
  const createRedisPool = async () => {
    return await redisConnectionPoolFactory(REDIS_POOL_NAME, redisConfig);
  };
  pool = createRedisPool();
}

const isHealthy = async () => {
  const redisPool = await getRedisPool();
  if (!redisPool) {
    return false;
  }
  try {
    const result = await redisPool.sendCommand("PING");
    return result === "PONG";
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getRedisPool = async () => {
  return pool;
};

// get a value from Redis cache
const getCacheValue = async (key) => {
  const redisPool = await getRedisPool();
  if (!redisPool) {
    return null;
  }
  try {
    const hashedKey = getCacheKey(key);
    const value = await redisPool.get(hashedKey);
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
  const redisPool = await getRedisPool();
  if (!redisPool) {
    return null;
  }
  try {
    const serializedValue = JSON.stringify(value);
    const hashedKey = getCacheKey(key);
    const result = await redisPool.set(hashedKey, serializedValue, ttl);
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

module.exports = { getCacheValue, setCacheValue, isHealthy };
