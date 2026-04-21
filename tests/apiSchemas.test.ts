import { describe, it, expect } from "vitest";
import {
  parseAllowedProxyUrl,
  letterboxdWatchlistBodySchema,
  alternativeSearchBodySchema,
  firstZodIssueMessage,
} from "@server/lib/apiSchemas.js";

describe("apiSchemas (zod)", () => {
  it("parseAllowedProxyUrl matches proxy security rules", () => {
    expect(parseAllowedProxyUrl("https://api.themoviedb.org/3/search/movie?query=x").ok).toBe(true);
    expect(parseAllowedProxyUrl("http://api.themoviedb.org/foo").ok).toBe(false);
    expect(parseAllowedProxyUrl("https://evil.com/").ok).toBe(false);
  });

  it("letterboxdWatchlistBodySchema rejects invalid body", () => {
    const r = letterboxdWatchlistBodySchema.safeParse({ username: "a", listUrl: "not-a-url" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.includes("listUrl"))).toBe(true);
  });

  it("alternativeSearchBodySchema requires title", () => {
    const r = alternativeSearchBodySchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(firstZodIssueMessage(r.error)).toBe("Title is required");
  });
});
