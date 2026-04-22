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
});
