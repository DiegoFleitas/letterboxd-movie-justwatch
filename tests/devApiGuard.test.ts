import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyReply } from "fastify";
import {
  devRedisApisAllowedOrReply,
  getDevApiGuardFailure,
  getEffectiveRedisUrlForDevGuard,
  isLocalRedisTarget,
  isNodeProductionEnvironment,
} from "@server/lib/devApiGuard.js";

describe("devApiGuard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isNodeProductionEnvironment", () => {
    it("is true when NODE_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isNodeProductionEnvironment()).toBe(true);
    });

    it("is false when NODE_ENV is not production", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(isNodeProductionEnvironment()).toBe(false);
    });
  });

  describe("getDevApiGuardFailure", () => {
    it("returns production when NODE_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(getDevApiGuardFailure()).toEqual({
        code: "production",
        message: "Not available in production",
      });
    });

    it("returns redis_disabled when DISABLE_REDIS is set", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("DISABLE_REDIS", "1");
      expect(getDevApiGuardFailure()?.code).toBe("redis_disabled");
    });

    it("returns non_local_redis for remote host", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("DISABLE_REDIS", "");
      vi.stubEnv("FLYIO_REDIS_URL", "rediss://user:pass@cache.example.com:6380");
      const f = getDevApiGuardFailure();
      expect(f?.code).toBe("non_local_redis");
      expect(f?.message).toContain("cache.example.com");
    });

    it("returns null for development + localhost", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("FLYIO_REDIS_URL", "redis://localhost:6379");
      expect(getDevApiGuardFailure()).toBeNull();
    });

    it("returns null for development + docker compose redis hostname", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("FLYIO_REDIS_URL", "redis://redis:6379");
      expect(getDevApiGuardFailure()).toBeNull();
    });

    it("returns null when FLYIO_REDIS_URL is unset (defaults to localhost)", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("DISABLE_REDIS", "");
      delete process.env.FLYIO_REDIS_URL;
      expect(getEffectiveRedisUrlForDevGuard()).toBe("redis://localhost:6379");
      expect(getDevApiGuardFailure()).toBeNull();
    });
  });

  describe("isLocalRedisTarget", () => {
    it("honors ALLOW_NON_LOCAL_REDIS", () => {
      vi.stubEnv("ALLOW_NON_LOCAL_REDIS", "1");
      expect(isLocalRedisTarget("redis://evil.example:6379")).toBe(true);
    });

    it("allows DEV_REDIS_API_EXTRA_HOSTS", () => {
      vi.stubEnv("ALLOW_NON_LOCAL_REDIS", "");
      vi.stubEnv("DEV_REDIS_API_EXTRA_HOSTS", "my-redis,other");
      expect(isLocalRedisTarget("redis://my-redis:6379")).toBe(true);
      expect(isLocalRedisTarget("redis://other:6379")).toBe(true);
      expect(isLocalRedisTarget("redis://not-listed:6379")).toBe(false);
    });
  });

  describe("devRedisApisAllowedOrReply", () => {
    function mockReply(): FastifyReply {
      const state = { status: 0, payload: null as unknown };
      return {
        code(c: number) {
          state.status = c;
          return this as unknown as FastifyReply;
        },
        send(p: unknown) {
          state.payload = p;
        },
        __state: state,
      } as unknown as FastifyReply & { __state: typeof state };
    }

    it("sends 404 in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const reply = mockReply() as FastifyReply & { __state: { status: number; payload: unknown } };
      expect(devRedisApisAllowedOrReply(reply)).toBe(false);
      expect(reply.__state.status).toBe(404);
    });

    it("sends 403 when Redis is disabled", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("DISABLE_REDIS", "1");
      const reply = mockReply() as FastifyReply & { __state: { status: number; payload: unknown } };
      expect(devRedisApisAllowedOrReply(reply)).toBe(false);
      expect(reply.__state.status).toBe(403);
    });

    it("sends 403 for non-local Redis", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("DISABLE_REDIS", "");
      vi.stubEnv("FLYIO_REDIS_URL", "redis://remote.cache:6379");
      const reply = mockReply() as FastifyReply & { __state: { status: number; payload: unknown } };
      expect(devRedisApisAllowedOrReply(reply)).toBe(false);
      expect(reply.__state.status).toBe(403);
    });

    it("returns true when checks pass", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("DISABLE_REDIS", "");
      vi.stubEnv("FLYIO_REDIS_URL", "redis://127.0.0.1:6379");
      const reply = mockReply() as FastifyReply & { __state: { status: number; payload: unknown } };
      expect(devRedisApisAllowedOrReply(reply)).toBe(true);
      expect(reply.__state.status).toBe(0);
    });
  });
});
