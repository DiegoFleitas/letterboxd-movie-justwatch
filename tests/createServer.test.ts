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
    const created = await createServer();
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

  it("trustProxy trusts one hop on Fly and nothing off Fly", async () => {
    const { resolveTrustProxySetting } = await import("@server/createServer.js");
    const onFly = resolveTrustProxySetting({
      FLY_APP_NAME: "letterboxd-test",
    } as NodeJS.ProcessEnv);
    expect(typeof onFly).toBe("function");
    expect((onFly as (address: string, hop: number) => boolean)("10.0.0.1", 0)).toBe(true);
    expect((onFly as (address: string, hop: number) => boolean)("10.0.0.1", 1)).toBe(false);
    expect(resolveTrustProxySetting({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("ignores spoofed X-Forwarded-For when FLY_APP_NAME is unset", async () => {
    vi.stubEnv("FLY_APP_NAME", "");
    const { createServer } = await import("@server/createServer.js");
    const created = await createServer();
    created.app.get("/__test_client_ip", async (request) => ({ ip: request.ip }));
    try {
      const res = await created.app.inject({
        method: "GET",
        url: "/__test_client_ip",
        headers: { "x-forwarded-for": "203.0.113.9" },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { ip: string }).ip).not.toBe("203.0.113.9");
    } finally {
      await created.app.close();
      vi.unstubAllEnvs();
    }
  });

  it("honours only the hop appended by the Fly edge, not client-supplied entries", async () => {
    // On Fly the edge appends the real client IP to X-Forwarded-For; entries a
    // caller injects to the left of it must not become request.ip.
    vi.stubEnv("FLY_APP_NAME", "letterboxd-movie-justwatch");
    const { createServer } = await import("@server/createServer.js");
    const created = await createServer();
    created.app.get("/__test_client_ip", async (request) => ({ ip: request.ip }));
    try {
      const res = await created.app.inject({
        method: "GET",
        url: "/__test_client_ip",
        headers: { "x-forwarded-for": "198.51.100.7, 203.0.113.9" },
        remoteAddress: "10.0.0.1",
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { ip: string }).ip).toBe("203.0.113.9");
    } finally {
      await created.app.close();
      vi.unstubAllEnvs();
    }
  });

  it("close calls disconnectRedis and shutdownPosthog", async () => {
    const disconnectRedis = vi.spyOn(redisLib, "disconnectRedis").mockResolvedValue(undefined);
    const shutdownPosthog = vi.spyOn(posthogLib, "shutdownPosthog").mockResolvedValue(undefined);

    const { createServer } = await import("@server/createServer.js");
    const created = await createServer();
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
