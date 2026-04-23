import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerFastifySessionPlugins } from "@server/registerFastifySessionPlugins.js";

describe("registerFastifySessionPlugins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("throws when NODE_ENV is production and APP_SECRET_KEY is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET_KEY", "");
    const app = Fastify({ logger: false });
    expect(() => registerFastifySessionPlugins(app)).toThrow(
      "APP_SECRET_KEY environment variable must be set in production.",
    );
    await app.close();
  });
});
