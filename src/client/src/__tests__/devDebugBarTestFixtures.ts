/** Default /api/dev/cache-status JSON used by DevDebugBar tests and default fetch mock. */
export const defaultDevCacheStatusPayload = {
  ok: true,
  redisKeyPrefix: "movie-justwatch",
  watchlistCacheEntries: 3,
  hasWatchlistCache: true,
  listCacheEntries: 1,
  hasListCache: true,
  searchMovieCacheEntries: 2,
  hasSearchMovieCache: true,
  searchMovieApproxStringKeys: 5,
  searchMovieScannedStringKeys: 120,
  searchMovieUnindexedApprox: 3,
  soonestIndexedKeyExpiryAtMs: null,
  justWatchHttpErrors: { total: 0, byStatus: {} },
} as const;

/** Minimal cache-status JSON for DevDebugBarGate default fetch mock. */
export const devDebugBarGateDefaultPayload = {
  ok: true,
  redisKeyPrefix: "movie-justwatch",
  watchlistCacheEntries: 0,
  hasWatchlistCache: false,
  listCacheEntries: 0,
  hasListCache: false,
  searchMovieCacheEntries: 0,
  hasSearchMovieCache: false,
  searchMovieApproxStringKeys: 0,
  searchMovieScannedStringKeys: 0,
  searchMovieUnindexedApprox: 0,
  soonestIndexedKeyExpiryAtMs: null,
  justWatchHttpErrors: { total: 0, byStatus: {} },
} as const;

/** Same shape as default payload but tuned for clear-list-cache interaction tests. */
export const devDebugBarListClearStatusPayload = {
  ok: true,
  redisKeyPrefix: "movie-justwatch",
  watchlistCacheEntries: 1,
  hasWatchlistCache: true,
  listCacheEntries: 0,
  hasListCache: true,
  searchMovieCacheEntries: 0,
  hasSearchMovieCache: true,
  searchMovieApproxStringKeys: 0,
  searchMovieScannedStringKeys: 0,
  searchMovieUnindexedApprox: 0,
  soonestIndexedKeyExpiryAtMs: null,
  justWatchHttpErrors: { total: 0, byStatus: {} },
} as const;
