import UserAgent from "user-agents";

/**
 * Random realistic desktop browser User-Agent for outbound HTML/asset fetches (Letterboxd, CDN).
 * Uses the `user-agents` package so strings stay plausible and vary per request.
 *
 * Set `SCRAPER_USER_AGENT` to pin a single UA (debugging or allowlisting).
 */
export function getRandomScrapeUserAgent(): string {
  const fixed = process.env.SCRAPER_USER_AGENT?.trim();
  if (fixed) {
    return fixed;
  }
  return new UserAgent({ deviceCategory: "desktop" }).toString();
}
