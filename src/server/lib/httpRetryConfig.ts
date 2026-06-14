/**
 * Shared HTTP 429-retry tuning + URL sanitisation. Used by both the axios
 * instance (enrichment APIs) and the Letterboxd fetch client so retry behaviour
 * and log redaction stay consistent across all outbound clients.
 */

/** Max number of 429 retries (env `AXIOS_429_MAX_RETRIES`, default 5). */
export const getMax429Retries = (): number => {
  const n = Number(process.env.AXIOS_429_MAX_RETRIES);
  if (Number.isFinite(n) && n >= 0) {
    return Math.floor(n);
  }
  return 5;
};

/** Cap wait between 429 retries (seconds) to avoid multi-minute stalls. */
export const max429RetryAfterSeconds = (): number => {
  const n = Number(process.env.AXIOS_429_MAX_RETRY_AFTER_SECONDS);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(Math.floor(n), 120);
  }
  return 60;
};

/** Redact common API key-style query params before logging a URL. */
export const sanitizeRequestUrl = (url: string | undefined): string =>
  url ? url.replace(/((?:api_key|apikey|access_token|token|key)=)([^&]+)/gi, "$1***") : "";
