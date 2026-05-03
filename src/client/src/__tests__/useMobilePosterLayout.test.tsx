// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MOBILE_POSTER_MEDIA_QUERY, useMobilePosterLayout } from "../useMobilePosterLayout";

function setupMatchMedia(initialMatches: boolean): {
  setMatches: (next: boolean) => void;
} {
  let matches = initialMatches;
  const listeners = new Set<EventListener>();

  const mq = {
    get matches(): boolean {
      return matches;
    },
    media: MOBILE_POSTER_MEDIA_QUERY,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener(_event: string, cb: EventListener): void {
      listeners.add(cb);
    },
    removeEventListener(_event: string, cb: EventListener): void {
      listeners.delete(cb);
    },
    dispatchEvent: vi.fn(),
  };

  const matchMediaImpl = (query: string): MediaQueryList => {
    expect(query).toBe(MOBILE_POSTER_MEDIA_QUERY);
    return mq as unknown as MediaQueryList;
  };

  Object.defineProperty(globalThis.window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(matchMediaImpl),
  });

  function setMatches(next: boolean): void {
    matches = next;
    listeners.forEach((cb) => {
      cb({ matches: next } as MediaQueryListEvent);
    });
  }

  return { setMatches };
}

describe("useMobilePosterLayout", () => {
  let originalMatchMedia: typeof globalThis.window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = globalThis.window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(globalThis.window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    vi.restoreAllMocks();
  });

  it("returns false when matchMedia reports desktop width initially", () => {
    setupMatchMedia(false);
    const { result } = renderHook(() => useMobilePosterLayout());
    expect(result.current).toBe(false);
  });

  it("returns true when matchMedia reports mobile width initially", () => {
    setupMatchMedia(true);
    const { result } = renderHook(() => useMobilePosterLayout());
    expect(result.current).toBe(true);
  });

  it("updates when matchMedia change fires", async () => {
    const { setMatches } = setupMatchMedia(false);
    const { result } = renderHook(() => useMobilePosterLayout());

    expect(result.current).toBe(false);

    await act(async () => {
      setMatches(true);
    });

    expect(result.current).toBe(true);

    await act(async () => {
      setMatches(false);
    });

    expect(result.current).toBe(false);
  });

  it("returns false when window.matchMedia is not a function", () => {
    Object.defineProperty(globalThis.window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useMobilePosterLayout());

    expect(result.current).toBe(false);
  });
});
