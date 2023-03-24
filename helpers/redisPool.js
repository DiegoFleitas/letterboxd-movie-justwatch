const redisConnectionPoolFactory = require("redis-connection-pool").default;
require("dotenv").config();

const REDIS_POOL_NAME = "default";

const redisConfig = {
  url: process.env.FLYIO_REDIS_URL || "redis://localhost:6379",
  max_clients: 25,
  perform_checks: true,
  database: 0,
  acquireTimeoutMillis: 1000,
};

const pool = redisConnectionPoolFactory(REDIS_POOL_NAME, redisConfig);

module.exports = pool;
