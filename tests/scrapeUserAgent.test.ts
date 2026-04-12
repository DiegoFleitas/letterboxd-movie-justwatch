import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getRandomScrapeUserAgent } from "../lib/scrapeUserAgent.js";

describe("getRandomScrapeUserAgent", () => {
  const prev = process.env.SCRAPER_USER_AGENT;

  beforeEach(() => {
    delete process.env.SCRAPER_USER_AGENT;
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.SCRAPER_USER_AGENT;
    } else {
      process.env.SCRAPER_USER_AGENT = prev;
    }
  });

  it("returns SCRAPER_USER_AGENT when set", () => {
    process.env.SCRAPER_USER_AGENT = "  CustomBot/1.0  ";
    expect(getRandomScrapeUserAgent()).toBe("CustomBot/1.0");
  });

  it("returns a desktop-like UA when unset (user-agents package)", () => {
    const ua = getRandomScrapeUserAgent();
    expect(ua.length).toBeGreaterThan(20);
    expect(ua.toLowerCase()).toMatch(/mozilla|applewebkit/);
  });
});
