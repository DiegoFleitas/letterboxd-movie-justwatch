import Fastify from "fastify";
import { describe, it, expect, vi, afterEach } from "vitest";
import { registerDevHttpRoutes } from "@server/registerDevHttpRoutes.js";

describe("registerDevHttpRoutes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not register /api/dev/* when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = Fastify({ logger: false });
    registerDevHttpRoutes(app);
    await app.ready();
    const res = await app.inject({ method: "POST", url: "/api/dev/clear-list-cache" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rate-limits dev routes (429 after max requests in the window)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DISABLE_REDIS", "1");
    const app = Fastify({ logger: false });
    registerDevHttpRoutes(app);
    await app.ready();
    let lastStatus = 0;
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: "POST", url: "/api/dev/clear-list-cache" });
      lastStatus = res.statusCode;
      if (res.statusCode === 429) break;
    }
    expect(lastStatus).toBe(429);
    await app.close();
  });

  it("registers simplified Redis routes and removes legacy ones", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DISABLE_REDIS", "1");
    const app = Fastify({ logger: false });
    registerDevHttpRoutes(app);
    await app.ready();

    const reset = await app.inject({ method: "POST", url: "/api/dev/reset-redis" });
    const exportSnapshot = await app.inject({ method: "POST", url: "/api/dev/export-redis" });
    const oldSeed = await app.inject({ method: "POST", url: "/api/dev/seed-redis" });
    const oldValidate = await app.inject({
      method: "POST",
      url: "/api/dev/validate-redis-snapshot",
    });
    const oldRefresh = await app.inject({ method: "POST", url: "/api/dev/refresh-local-seed" });

    expect(reset.statusCode).toBe(403);
    expect(exportSnapshot.statusCode).toBe(403);
    expect(oldSeed.statusCode).toBe(404);
    expect(oldValidate.statusCode).toBe(404);
    expect(oldRefresh.statusCode).toBe(404);

    await app.close();
  });
});
