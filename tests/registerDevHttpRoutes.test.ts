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
});
