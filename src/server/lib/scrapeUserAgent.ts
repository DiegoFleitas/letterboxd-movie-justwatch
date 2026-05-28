import UserAgent from "user-agents";

/**
 * Realistic desktop browser User-Agent for outbound HTML/asset fetches (Letterboxd, CDN).
 * Generated once and cached — avoids the UserAgent constructor cost per request.
 *
 * Set `SCRAPER_USER_AGENT` to pin a single UA (debugging or allowlisting).
 */
let cachedUserAgent: string | null = null;

export function getRandomScrapeUserAgent(): string {
  const fixed = process.env.SCRAPER_USER_AGENT?.trim();
  if (fixed) {
    return fixed;
  }
  if (!cachedUserAgent) {
    cachedUserAgent = new UserAgent({ deviceCategory: "desktop" }).toString();
  }
  return cachedUserAgent;
}
