/**
 * Outbound timeout for Letterboxd HTML/CDN fetches (lists, ESI retry, poster probe).
 * Axios default is 0 (no limit), which can hang indefinitely on stalled connections.
 */
export function getLetterboxdFetchTimeoutMs(): number {
  const n = Number(process.env.LETTERBOXD_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}
