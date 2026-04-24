import { describe, it, expect } from "vitest";
import {
  parseAllowedProxyUrl,
  letterboxdWatchlistBodySchema,
  letterboxdCustomListBodySchema,
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

  it("letterboxdWatchlistBodySchema rejects username mismatch", () => {
    const r = letterboxdWatchlistBodySchema.safeParse({
      username: "wrong",
      listUrl: "https://letterboxd.com/user/watchlist/",
    });
    expect(r.success).toBe(false);
  });

  it("letterboxdWatchlistBodySchema accepts matching username and watchlist URL", () => {
    const r = letterboxdWatchlistBodySchema.safeParse({
      username: "user",
      listUrl: "https://letterboxd.com/user/watchlist/",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.parsedListUrl).toContain("/user/watchlist/");
  });

  it("letterboxdCustomListBodySchema transforms valid custom list URL", () => {
    const r = letterboxdCustomListBodySchema.safeParse({
      listUrl: "https://letterboxd.com/user/list/my-list/",
    });
    expect(r.success).toBe(true);
  });

  it("letterboxdCustomListBodySchema rejects non-custom list URL", () => {
    const r = letterboxdCustomListBodySchema.safeParse({
      listUrl: "https://letterboxd.com/user/watchlist/",
    });
    expect(r.success).toBe(false);
  });

  it("letterboxdCustomListBodySchema rejects username that does not match URL", () => {
    const r = letterboxdCustomListBodySchema.safeParse({
      listUrl: "https://letterboxd.com/user/list/my-list/",
      username: "other",
    });
    expect(r.success).toBe(false);
  });

  it("alternativeSearchBodySchema requires title", () => {
    const r = alternativeSearchBodySchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(firstZodIssueMessage(r.error)).toBe("Title is required");
  });
});
