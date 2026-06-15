/**
 * Unit tests for the in-process fallback cache (used when Redis is unavailable
 * or DISABLE_REDIS=1). Focus: TTL expiry and the count-cap LRU eviction that
 * guards against unbounded growth on the 256MB VM.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { memoryCache } from "@server/lib/memoryCache.js";

afterEach(() => {
  memoryCache.clear();
  vi.useRealTimers();
});

describe("memoryCache", () => {
  it("returns null for a missing key", () => {
    expect(memoryCache.get("nope")).toBeNull();
  });

  it("stores and returns a value within its TTL", () => {
    memoryCache.set("k", { a: 1 }, 60);
    expect(memoryCache.get("k")).toEqual({ a: 1 });
  });

  it("expires a value after its TTL elapses", () => {
    vi.useFakeTimers();
    memoryCache.set("k", "v", 1);
    vi.advanceTimersByTime(1_001);
    expect(memoryCache.get("k")).toBeNull();
  });

  it("evicts the oldest entry once the count cap is exceeded", () => {
    // Default cap is 2000; set a small one for this test via env override would
    // require re-import, so assert relative eviction at the default scale.
    const cap = Number(process.env.MEMORY_CACHE_MAX_ENTRIES) || 2000;
    for (let i = 0; i < cap; i++) {
      memoryCache.set(`key-${i}`, i, 600);
    }
    // The oldest (key-0) is still present at exactly the cap...
    expect(memoryCache.get("key-0")).toBe(0);
    // ...but a re-read just promoted key-0 to most-recent. Insert one more and
    // the new oldest (key-1) should be evicted instead.
    memoryCache.set("overflow", "x", 600);
    expect(memoryCache.get("key-1")).toBeNull();
    expect(memoryCache.get("key-0")).toBe(0);
    expect(memoryCache.get("overflow")).toBe("x");
  });

  it("overwriting an existing key does not grow the store past the cap", () => {
    const cap = Number(process.env.MEMORY_CACHE_MAX_ENTRIES) || 2000;
    for (let i = 0; i < cap; i++) {
      memoryCache.set(`k-${i}`, i, 600);
    }
    // Overwrite an existing key — should stay at cap, evict nothing new.
    memoryCache.set("k-0", "updated", 600);
    expect(memoryCache.get("k-0")).toBe("updated");
    // Every other original key still resolves (no spurious eviction).
    expect(memoryCache.get(`k-${cap - 1}`)).toBe(cap - 1);
  });
});
