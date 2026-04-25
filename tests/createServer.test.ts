import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as posthogLib from "@server/lib/posthog.js";
import * as redisLib from "@server/lib/redis.js";
import { _injectRedisClientForTest, _resetRedisForTesting } from "@server/lib/redis.js";
import { HTTP_API_PATHS } from "@server/routes.js";
import { createInMemoryRedisMock } from "./helpers/inMemoryRedisMock.js";

describe("createServer", () => {
  let savedPosthogKey: string | undefined;

  beforeEach(() => {
    savedPosthogKey = process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_KEY;
    _injectRedisClientForTest(createInMemoryRedisMock() as never);
  });

  afterEach(async () => {
    if (savedPosthogKey === undefined) delete process.env.POSTHOG_KEY;
    else process.env.POSTHOG_KEY = savedPosthogKey;
    _resetRedisForTesting();
    vi.restoreAllMocks();
  });

  it("error handler returns JSON 500 for uncaught route errors", async () => {
    const { createServer } = await import("@server/createServer.js");
    const created = createServer();
    created.app.get("/__test_throw", async () => {
      throw new Error("planned failure");
    });
    const { close } = await created.start(0);
    try {
      const res = await created.app.inject({
        method: "GET",
        url: "/__test_throw",
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ error: "Internal Server Error" });
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

  it("routes PostHog ingest requests through first-party proxy", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { createServer } = await import("@server/createServer.js");
    const created = createServer();
    const { close } = await created.start(0);
    try {
      const response = await created.app.inject({
        method: "POST",
        url: `${HTTP_API_PATHS.posthogProxyPrefix}/e/`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "test-event" }),
      });

      expect(response.statusCode).toBe(200);
      const proxiedCall = fetchSpy.mock.calls.find((call) =>
        String(call[0] ?? "").startsWith("https://us.i.posthog.com"),
      );
      expect(proxiedCall).toBeTruthy();
      expect(String(proxiedCall?.[0] ?? "")).toContain("https://us.i.posthog.com/e/");
    } finally {
      fetchSpy.mockRestore();
      await close();
    }
  });

  it("routes PostHog static assets through US assets host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const { createServer } = await import("@server/createServer.js");
    const created = createServer();
    const { close } = await created.start(0);
    try {
      const response = await created.app.inject({
        method: "GET",
        url: `${HTTP_API_PATHS.posthogProxyPrefix}/static/array.js`,
      });

      expect(response.statusCode).toBe(200);
      const proxiedCall = fetchSpy.mock.calls.find((call) =>
        String(call[0] ?? "").startsWith("https://us-assets.i.posthog.com"),
      );
      expect(proxiedCall).toBeTruthy();
      expect(String(proxiedCall?.[0] ?? "")).toContain(
        "https://us-assets.i.posthog.com/static/array.js",
      );
    } finally {
      fetchSpy.mockRestore();
      await close();
    }
  });
});
