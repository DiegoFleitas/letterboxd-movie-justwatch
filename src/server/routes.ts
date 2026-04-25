/**
 * HTTP path constants shared by Fastify and the Vite client (`@server/routes`).
 * Not Fastify registration — only strings and small helpers.
 */

/** Development-only JSON APIs (`registerDevHttpRoutes` + `DevDebugBar`). */
export const DEV_HTTP_API_PREFIX = "/api/dev" as const;

/**
 * First-party PostHog reverse-proxy path.
 * Keep this non-obvious to reduce block-list matches by ad blockers.
 */
export const POSTHOG_PROXY_DEFAULT_PATH = "/phc4v7x" as const;

/** Production same-origin JSON + proxy endpoints. */
export const HTTP_API_PATHS = {
  searchMovie: "/api/search-movie",
  poster: "/api/poster",
  letterboxdWatchlist: "/api/letterboxd-watchlist",
  letterboxdCustomList: "/api/letterboxd-custom-list",
  letterboxdPoster: "/api/letterboxd-poster",
  alternativeSearch: "/api/alternative-search",
  subdlSearch: "/api/subdl-search",
  proxyPrefix: "/api/proxy",
  sentryTest: "/api/sentry-test",
  posthogProxyPrefix: POSTHOG_PROXY_DEFAULT_PATH,
} as const;

/** Fastify `app.all` pattern for the HTTP proxy mount (must end with `/*`). */
export const HTTP_API_PROXY_ROUTE = `${HTTP_API_PATHS.proxyPrefix}/*` as const;
export const HTTP_API_POSTHOG_PROXY_ROUTE = `${HTTP_API_PATHS.posthogProxyPrefix}/*` as const;

/** Strip our proxy mount from `req.url` to recover the target URL string. */
export function proxyTargetFromRequestUrl(requestUrl = ""): string {
  const normalizedRequestUrl = requestUrl;
  const proxyPrefixWithSlash = `${HTTP_API_PATHS.proxyPrefix}/`;
  const proxyPrefixIndex = normalizedRequestUrl.indexOf(proxyPrefixWithSlash);

  if (proxyPrefixIndex === -1) {
    return normalizedRequestUrl;
  }

  return normalizedRequestUrl.slice(proxyPrefixIndex + proxyPrefixWithSlash.length);
}

/** Strip PostHog reverse-proxy mount from `req.url` to recover upstream path/query. */
export function posthogProxyTargetFromRequestUrl(requestUrl = ""): string {
  const normalizedRequestUrl = requestUrl;
  const posthogPrefixWithSlash = `${HTTP_API_PATHS.posthogProxyPrefix}/`;
  const posthogPrefixIndex = normalizedRequestUrl.indexOf(posthogPrefixWithSlash);

  if (posthogPrefixIndex === -1) {
    return normalizedRequestUrl;
  }

  return `/${normalizedRequestUrl.slice(posthogPrefixIndex + posthogPrefixWithSlash.length)}`;
}
