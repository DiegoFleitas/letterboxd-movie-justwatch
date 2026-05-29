import { HTTP_API_PATHS } from "@server/routes";

const SEARCH_MOVIE_TIMEOUT_MS = 60_000;
const SEARCH_MOVIE_MAX_RETRIES = 2;
export const SEARCH_MOVIE_TOTAL_ATTEMPTS = SEARCH_MOVIE_MAX_RETRIES + 1;

export const SEARCH_MOVIE_NETWORK_ERROR_MESSAGE =
  "Network error loading streaming data. Try again.";

const RETRY_DELAYS_MS = [500, 1500];
const MAX_RETRY_DELAY_MS = 3_000;

export interface SearchMovieRequestBody {
  title?: string | null;
  year?: string | number | null;
  country?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attemptIndex: number): number {
  const delay = RETRY_DELAYS_MS[attemptIndex] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export function isRetryableFetchError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return true;
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true;
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }
  return false;
}

export async function fetchSearchMovie(
  body: SearchMovieRequestBody,
  externalSignal?: AbortSignal | null,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SEARCH_MOVIE_TOTAL_ATTEMPTS; attempt++) {
    try {
      const timeoutSignal = AbortSignal.timeout(SEARCH_MOVIE_TIMEOUT_MS);
      const signal = externalSignal
        ? mergeAbortSignals([timeoutSignal, externalSignal])
        : timeoutSignal;
      return await fetch(HTTP_API_PATHS.searchMovie, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-By": "MovieJustWatch" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      lastError = error;
      if (externalSignal?.aborted) {
        throw error;
      }
      const hasRetriesLeft = attempt < SEARCH_MOVIE_MAX_RETRIES;
      if (!hasRetriesLeft || !isRetryableFetchError(error)) {
        throw error;
      }
      await sleep(retryDelayMs(attempt));
    }
  }
  throw lastError;
}
