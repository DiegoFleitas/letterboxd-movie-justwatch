import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let pipelinePhase = 0;

vi.mock("ioredis", () => ({
  default: class FakeRedis {
    constructor(url: string, opts?: unknown) {
      void url;
      void opts;
    }
    scanStream(opts: { match: string; count: number }) {
      void opts;
      const stream = {
        pause: vi.fn(),
        resume: vi.fn(),
        on(ev: string, fn: (...args: unknown[]) => void) {
          if (ev === "error") return stream;
          if (ev === "data") {
            queueMicrotask(() => fn(["app:deadbeefcafe"]));
          }
          if (ev === "end") {
            queueMicrotask(() => {
              (fn as () => void)();
            });
          }
          return stream;
        },
      };
      return stream;
    }
    pipeline() {
      const chain = {
        type() {
          return chain;
        },
        pttl() {
          return chain;
        },
        get() {
          return chain;
        },
        exists() {
          return chain;
        },
        exec: async () => {
          pipelinePhase += 1;
          if (pipelinePhase === 1) {
            return [[null, "string"] as [null, string]];
          }
          return [
            [null, 120_000] as [null, number],
            [null, JSON.stringify({ title: "Cached", movieProviders: [] })] as [null, string],
          ];
        },
      };
      return chain;
    }
    quit() {
      return Promise.resolve("OK");
    }
  },
}));

describe("estimateSearchMovieStringKeyCount", () => {
  beforeEach(() => {
    pipelinePhase = 0;
    vi.stubEnv("DISABLE_REDIS", "");
    vi.stubEnv("FLYIO_REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("FLY_APP_NAME", "app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("counts string keys that look like search-movie cache JSON", async () => {
    const { estimateSearchMovieStringKeyCount } = await import("@server/lib/redis.js");
    const r = await estimateSearchMovieStringKeyCount();
    expect(r.error).toBeUndefined();
    expect(r.scannedStringKeys).toBeGreaterThanOrEqual(1);
    expect(r.approxSearchMovieStringKeys).toBeGreaterThanOrEqual(1);
  });
});
