const crypto = require("crypto");
const { poolPromise } = require("./redisPool");

const isHealthy = async () => {
  try {
    const pool = await poolPromise;
    const result = await pool.sendCommand("PING");
    return result === "PONG";
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getCacheValue = async (key) => {
  try {
    const pool = await poolPromise;
    const hashedKey = getCacheKey(key);
    const value = await pool.get(hashedKey);

    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  } catch (error) {
    return null;
  }
};

const setCacheValue = async (key, value, ttl = 60) => {
  try {
    const pool = await poolPromise;
    const serializedValue = JSON.stringify(value);
    const hashedKey = getCacheKey(key);
    const result = await pool.set(hashedKey, serializedValue, ttl);
    return result === "OK";
  } catch (error) {
    return false;
  }
};

const getCacheKey = (str) => {
  const hash = crypto.createHash("sha256");
  hash.update(str);
  // since upstash is shared, we need to namespace the keys
  return `${process.env.FLY_APP_NAME}:${hash.digest("hex")}`;
};

module.exports = { getCacheValue, setCacheValue, isHealthy };
