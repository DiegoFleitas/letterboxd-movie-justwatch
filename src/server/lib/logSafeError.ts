import { sanitizeRequestUrl } from "./httpRetryConfig.js";

const SECRET_QUERY_PARAM = /([?&](?:api_key|apikey|token|access_token|key|secret)=)[^&\s"']+/gi;
const BEARER_HEADER = /(Bearer\s+)\S+/gi;

function scrubText(text: string): string {
  return text.replace(SECRET_QUERY_PARAM, "$1[REDACTED]").replace(BEARER_HEADER, "$1[REDACTED]");
}

/**
 * Whitelisted projection of an upstream (axios/fetch) error: name, message, code and status
 * only. Never the error object itself, whose `config.url`/`config.headers` carry API keys.
 */
function upstreamErrorSummary(error: unknown): Record<string, unknown> {
  const err = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    config?: { url?: unknown; method?: unknown };
  };
  const summary: Record<string, unknown> = {
    name: typeof err?.name === "string" ? err.name : "Error",
    code: typeof err?.code === "string" ? err.code : undefined,
    status: typeof err?.response?.status === "number" ? err.response.status : undefined,
    method: typeof err?.config?.method === "string" ? err.config.method : undefined,
  };
  if (typeof err?.message === "string") summary.message = scrubText(err.message);
  if (typeof err?.config?.url === "string") summary.url = sanitizeRequestUrl(err.config.url);
  return summary;
}

export function logUpstreamError(route: string, error: unknown): void {
  console.error(`[${route}] upstream request failed`, upstreamErrorSummary(error));
}
