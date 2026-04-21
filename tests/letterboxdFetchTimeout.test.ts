import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLetterboxdFetchTimeoutMs } from "@server/lib/letterboxdFetchTimeout.js";

describe("getLetterboxdFetchTimeoutMs", () => {
  const prev = process.env.LETTERBOXD_FETCH_TIMEOUT_MS;

  beforeEach(() => {
    delete process.env.LETTERBOXD_FETCH_TIMEOUT_MS;
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.LETTERBOXD_FETCH_TIMEOUT_MS;
    } else {
      process.env.LETTERBOXD_FETCH_TIMEOUT_MS = prev;
    }
  });

  it("defaults to 25000 when unset", () => {
    expect(getLetterboxdFetchTimeoutMs()).toBe(25_000);
  });

  it("uses env when set to a positive number", () => {
    process.env.LETTERBOXD_FETCH_TIMEOUT_MS = "10000";
    expect(getLetterboxdFetchTimeoutMs()).toBe(10_000);
  });

  it("falls back to default for non-positive or invalid values", () => {
    process.env.LETTERBOXD_FETCH_TIMEOUT_MS = "0";
    expect(getLetterboxdFetchTimeoutMs()).toBe(25_000);
    process.env.LETTERBOXD_FETCH_TIMEOUT_MS = "nope";
    expect(getLetterboxdFetchTimeoutMs()).toBe(25_000);
  });
});
