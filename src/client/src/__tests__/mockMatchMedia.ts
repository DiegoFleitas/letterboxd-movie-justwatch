import { vi } from "vitest";

function createMediaQueryList(matches: boolean, query: string): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
}

/**
 * JSDOM may omit matchMedia; tests that render MovieTile should call this in beforeEach.
 * @param matches false = desktop (default tile behavior); true = mobile/narrow
 */
export function stubMatchMedia(matches: boolean): void {
  const impl = (query: string): MediaQueryList => createMediaQueryList(matches, query);
  const win = globalThis.window;
  if (typeof win.matchMedia === "function") {
    vi.spyOn(win, "matchMedia").mockImplementation(impl);
  } else {
    Object.defineProperty(win, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(impl),
    });
  }
}
