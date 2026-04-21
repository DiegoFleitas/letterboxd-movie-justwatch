import { getLetterboxdFetchTimeoutMs } from "./letterboxdFetchTimeout.js";

const sanitizeUrl = (url: string): string =>
  url.replace(/((?:api_key|apikey|access_token|token|key)=)([^&]+)/gi, "$1***");

const getMax429Retries = (): number => {
  const n = Number(process.env.AXIOS_429_MAX_RETRIES);
  if (Number.isFinite(n) && n >= 0) {
    return Math.floor(n);
  }
  return 5;
};

const max429RetryAfterSeconds = (): number => {
  const n = Number(process.env.AXIOS_429_MAX_RETRY_AFTER_SECONDS);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(Math.floor(n), 120);
  }
  return 60;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Primary MIME type without parameters (e.g. `text/html; charset=utf-8` → `text/html`). */
function primaryMediaType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

function assertHtmlResponseContentType(res: Response): void {
  const raw = res.headers.get("content-type");
  if (!raw) {
    return;
  }
  const mt = primaryMediaType(raw);
  if (
    mt === "text/html" ||
    mt === "application/xhtml+xml" ||
    mt === "text/xml" ||
    mt === "application/xml"
  ) {
    return;
  }
  throw new LetterboxdHttpError(
    `Expected HTML/XML for list page, got Content-Type: ${raw}`,
    res.status,
  );
}

function assertImageResponseContentType(res: Response): void {
  const raw = res.headers.get("content-type");
  if (!raw) {
    return;
  }
  const mt = primaryMediaType(raw);
  if (mt.startsWith("image/") || mt === "application/octet-stream") {
    return;
  }
  throw new LetterboxdHttpError(
    `Expected image for poster URL, got Content-Type: ${raw}`,
    res.status,
  );
}

export class LetterboxdHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LetterboxdHttpError";
    this.status = status;
  }
}

/** Browser-like request headers for scraping Letterboxd HTML list/watchlist pages. */
export function buildLetterboxdHtmlRequestHeaders(userAgent: string): Record<string, string> {
  return {
    "User-Agent": userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    Referer: "https://letterboxd.com/",
  };
}

/** Browser-like Accept for Letterboxd CDN poster (JPEG/WebP, etc.). */
export function buildLetterboxdImageRequestHeaders(userAgent: string): Record<string, string> {
  return {
    "User-Agent": userAgent,
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    Referer: "https://letterboxd.com/",
  };
}

/**
 * Outbound GET using `fetch` + `AbortSignal.timeout` (reliable under Bun; avoids axios adapter stalls).
 * Retries HTTP 429 up to `AXIOS_429_MAX_RETRIES` with capped Retry-After (same env as shared axios helper).
 */
async function fetchWith429Retry(url: string, headers: Record<string, string>): Promise<Response> {
  const timeoutMs = getLetterboxdFetchTimeoutMs();
  const maxRetries = getMax429Retries();
  let rateLimitCount = 0;

  for (;;) {
    console.log(`[letterboxd-http] GET ${sanitizeUrl(url)}`);
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 429) {
      rateLimitCount++;
      if (rateLimitCount > maxRetries) {
        throw new LetterboxdHttpError(`Rate limited after ${maxRetries} retries`, 429);
      }
      const raw = Number(res.headers.get("retry-after")) || 1;
      const retryAfterSec = Math.min(raw, max429RetryAfterSeconds());
      console.log(
        `[letterboxd-http] 429, retry ${rateLimitCount}/${maxRetries} in ${retryAfterSec}s`,
      );
      await sleep(retryAfterSec * 1000);
      continue;
    }

    return res;
  }
}

export async function fetchLetterboxdHtml(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const res = await fetchWith429Retry(url, headers);
  if (!res.ok) {
    throw new LetterboxdHttpError(`HTTP ${res.status}`, res.status);
  }
  assertHtmlResponseContentType(res);
  return res.text();
}

/** Probe URL (e.g. poster image); drains body. Throws LetterboxdHttpError if not ok. */
export async function fetchLetterboxdBinaryOk(
  url: string,
  headers: Record<string, string>,
): Promise<void> {
  const res = await fetchWith429Retry(url, headers);
  if (!res.ok) {
    throw new LetterboxdHttpError(`HTTP ${res.status}`, res.status);
  }
  assertImageResponseContentType(res);
  await res.arrayBuffer();
}
