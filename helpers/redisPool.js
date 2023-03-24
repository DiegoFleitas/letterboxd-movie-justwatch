const redisConnectionPoolFactory = require("redis-connection-pool").default;

const connectionPool = (() => {
  let instance;

  function createInstance() {
    const REDIS_POOL_NAME = "default";

    const redisConfig = {
      url: process.env.FLYIO_REDIS_URL || "redis://localhost:6379",
      max_clients: 25,
      perform_checks: true,
      database: 0,
      acquireTimeoutMillis: 1000,
    };

    return redisConnectionPoolFactory(REDIS_POOL_NAME, redisConfig);
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = createInstance();
      }
      return instance;
    },
  };
})();

module.exports = { poolPromise: connectionPool.getInstance() };
