import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as posthogLib from "@server/lib/posthog.js";
import * as redisLib from "@server/lib/redis.js";
import { _injectRedisClientForTest, _resetRedisForTesting } from "@server/lib/redis.js";
import { createInMemoryRedisMock } from "./helpers/inMemoryRedisMock.js";

describe("createServer", () => {
  beforeEach(() => {
    _injectRedisClientForTest(createInMemoryRedisMock() as never);
  });

  afterEach(async () => {
    _resetRedisForTesting();
    vi.restoreAllMocks();
  });

  it("error handler returns JSON 500 for uncaught route errors", async () => {
    const { createServer } = await import("@server/createServer.js");
    const created = createServer();
    created.app.get("/__test_throw", async () => {
      throw new Error("planned failure");
    });
    const { port, close } = await created.start(0);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/__test_throw`);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal Server Error" });
    } finally {
      await close();
    }
  });

  it("close calls disconnectRedis and shutdownPosthog", async () => {
    const disconnectRedis = vi.spyOn(redisLib, "disconnectRedis").mockResolvedValue(undefined);
    const shutdownPosthog = vi.spyOn(posthogLib, "shutdownPosthog").mockResolvedValue(undefined);

    const { createServer } = await import("@server/createServer.js");
    const created = createServer();
    const { close } = await created.start(0);
    try {
      await close();
      expect(disconnectRedis).toHaveBeenCalledTimes(1);
      expect(shutdownPosthog).toHaveBeenCalledTimes(1);
    } finally {
      disconnectRedis.mockRestore();
      shutdownPosthog.mockRestore();
    }
  });
});
