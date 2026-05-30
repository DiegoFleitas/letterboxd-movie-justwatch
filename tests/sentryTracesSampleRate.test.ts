import { describe, it, expect } from "vitest";
import {
  resolveTracesSampleRate,
  PRODUCTION_TRACES_SAMPLE_RATE,
} from "@server/lib/sentryCapture.js";

describe("resolveTracesSampleRate", () => {
  it("returns 0 in non-production when env unset", () => {
    expect(resolveTracesSampleRate(undefined, "development")).toBe(0);
    expect(resolveTracesSampleRate("", "test")).toBe(0);
  });

  it("defaults to production rate when env unset in production", () => {
    expect(resolveTracesSampleRate(undefined, "production")).toBe(PRODUCTION_TRACES_SAMPLE_RATE);
  });

  it("parses and clamps explicit env values", () => {
    expect(resolveTracesSampleRate("0.5", "production")).toBe(0.5);
    expect(resolveTracesSampleRate("2", "production")).toBe(1);
    expect(resolveTracesSampleRate("-1", "production")).toBe(0);
    expect(resolveTracesSampleRate("nope", "production")).toBe(PRODUCTION_TRACES_SAMPLE_RATE);
  });
});
