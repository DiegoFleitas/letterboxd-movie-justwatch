// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCountryFromIp } from "../countryGeo";

const COUNTRIES = [{ id: "country_US" }, { id: "country_AR" }, { id: "country_UY" }];

function setNavigatorLanguage(language: string): void {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: language,
  });
}

describe("fetchCountryFromIp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns matching country id when API returns known country_code", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ country_code: "US" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCountryFromIp(COUNTRIES)).resolves.toBe("country_US");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("falls back to locale when API country_code is unknown", async () => {
    setNavigatorLanguage("es-UY");
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ country_code: "ZZ" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCountryFromIp(COUNTRIES)).resolves.toBe("country_UY");
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(fetchCountryFromIp(COUNTRIES)).resolves.toBeNull();
  });

  it("returns null when request is aborted by timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_: string, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise((_, reject) => {
        if (!signal) return;
        signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchCountryFromIp(COUNTRIES);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toBeNull();
  });
});
