import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MINIMUM_PRODUCTION_APP_SECRET_KEY_LENGTH,
  registerFastifySessionPlugins,
} from "@server/registerFastifySessionPlugins.js";

function registerWithStubbedProductionEnv(appSecretKey: string | undefined): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_SECRET_KEY", appSecretKey ?? "");
  const app = Fastify({ logger: false });
  try {
    registerFastifySessionPlugins(app);
  } finally {
    void app.close();
  }
}

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

  it("throws in production when APP_SECRET_KEY is shorter than 32 characters", () => {
    expect(() => registerWithStubbedProductionEnv("short-session-key")).toThrow(
      `APP_SECRET_KEY must be at least ${MINIMUM_PRODUCTION_APP_SECRET_KEY_LENGTH} characters in production.`,
    );
  });

  it("throws in production for the placeholder default historically shipped in .env.example", () => {
    // 50 characters, same shape as the removed `.env.example` placeholder: long
    // enough for the length check, still a well-known value.
    const knownDefault = "replace-me-with-a-random-secret-of-at-least-32-characters";
    expect(knownDefault.length).toBeGreaterThanOrEqual(MINIMUM_PRODUCTION_APP_SECRET_KEY_LENGTH);
    expect(() => registerWithStubbedProductionEnv(knownDefault)).toThrow(
      "APP_SECRET_KEY must not be a well-known default or placeholder in production.",
    );
  });

  it("throws in production for a changeme-style placeholder", () => {
    expect(() => registerWithStubbedProductionEnv("changeme-changeme-changeme-changeme")).toThrow(
      "APP_SECRET_KEY must not be a well-known default or placeholder in production.",
    );
  });

  it("accepts a long random-looking secret in production", () => {
    expect(() =>
      registerWithStubbedProductionEnv("9f2c1d7b4a6e8c0d3b5a7f1e2d4c6b8a"),
    ).not.toThrow();
  });

  it("does not enforce length or placeholder rules outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_SECRET_KEY", "short");
    const app = Fastify({ logger: false });
    expect(() => registerFastifySessionPlugins(app)).not.toThrow();
    void app.close();
  });
});
