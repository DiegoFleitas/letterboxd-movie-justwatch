import React, { useEffect } from "react";
import { DEV_HTTP_API_PREFIX } from "@server/routes";
import { useAppState } from "./AppStateContext";
import { isDevDebugBarEnabled } from "./devDebugBarEnv";
import "./DevDebugBar.css";

type DevPostJson = { ok?: boolean; error?: string; cleared?: number; stdout?: string };
type JustWatchHttpErrorsSnapshot = {
  total: number;
  byStatus: Record<string, number>;
  last?: { status: number; at: string };
};
type CacheStatusJson = {
  ok?: boolean;
  error?: string;
  redisKeyPrefix?: string;
  /** When set, server read numeric `CACHE_TTL` (seconds). `null` = unset or invalid in this process. */
  cacheTtlEnvSeconds?: number | null;
  watchlistCacheEntries?: number;
  hasWatchlistCache?: boolean;
  listCacheEntries?: number;
  hasListCache?: boolean;
  searchMovieCacheEntries?: number;
  hasSearchMovieCache?: boolean;
  searchMovieApproxStringKeys?: number;
  searchMovieScannedStringKeys?: number;
  searchMovieUnindexedApprox?: number;
  /** Epoch ms when the soonest PTTL among indexed watchlist/list/search-movie keys expires; null if none. */
  soonestIndexedKeyExpiryAtMs?: number | null;
  justWatchHttpErrors?: JustWatchHttpErrorsSnapshot;
};
type CacheStatusTone = "neutral" | "progress" | "ok" | "error";
type CacheStatus = { text: string; tone: CacheStatusTone; title: string };
const CACHE_STATUS_POLL_MS_IDLE = 10_000;
const CACHE_STATUS_POLL_MS_LOADING = 2_500;

/** Survives full page reload so dev pills do not flash back to "checking…" while Redis is unchanged. */
const SESSION_CACHE_STATUS_KEY = "lbjw:dev-cache-status-payload-v1";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function formatJustWatchHttpBreakdown(byStatus: Record<string, number> | undefined): string {
  if (!byStatus) return "(no samples yet)";
  const entries = Object.entries(byStatus)
    .map(([k, v]) => ({ status: Number(k), count: v }))
    .filter((e) => Number.isFinite(e.status));
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.status - b.status;
  });
  if (entries.length === 0) return "(no samples yet)";
  return entries.map((e) => `${e.status}: ${e.count}`).join(", ");
}

function buildJustWatchPillTitle(snapshot: JustWatchHttpErrorsSnapshot | undefined): string {
  return [
    "JustWatch outbound HTTP attempts (GraphQL via axios):",
    "- Counts non-success attempts (HTTP status not 2xx), including retries during backoff.",
    "- Status `0` means no HTTP response was received (timeouts/DNS/etc).",
    "",
    `Total non-success attempts: ${snapshot?.total ?? 0}`,
    `By status: ${formatJustWatchHttpBreakdown(snapshot?.byStatus)}`,
    ...(snapshot?.last ? ["", `Last: HTTP ${snapshot.last.status} at ${snapshot.last.at}`] : []),
  ].join("\n");
}

function justWatchErrTone(total: number, isListLoading: boolean): CacheStatusTone {
  if (isListLoading) return "progress";
  if (total > 0) return "error";
  return "ok";
}

function buildJustWatchStatusFromPayload(
  data: CacheStatusJson,
  isListLoading: boolean,
  titleSuffix = "",
): CacheStatus {
  const jw = data.justWatchHttpErrors;
  const total = jw?.total ?? 0;
  return {
    text: `JW errs: ${total}${isListLoading ? " (loading)" : ""}`,
    tone: justWatchErrTone(total, isListLoading),
    title: buildJustWatchPillTitle(jw) + titleSuffix,
  };
}

function readStoredCacheStatusPayload(): CacheStatusJson | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_STATUS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CacheStatusJson;
    if (!data || typeof data !== "object" || data.ok === false) return null;
    return data;
  } catch {
    return null;
  }
}

function persistCacheStatusPayload(data: CacheStatusJson): void {
  try {
    sessionStorage.setItem(SESSION_CACHE_STATUS_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function parseSoonestIndexedKeyExpiryAtMs(data: CacheStatusJson): number | null {
  const v = data.soonestIndexedKeyExpiryAtMs;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function cachePillTone(
  isListLoading: boolean,
  count: number,
  listCount: number,
  searchCount: number,
  searchApprox: number,
): CacheStatusTone {
  if (isListLoading) return "progress";
  if (count > 0 || listCount > 0 || searchCount > 0 || searchApprox > 0) return "ok";
  return "neutral";
}

function deriveCacheStatusesFromPayload(
  data: CacheStatusJson,
  isListLoading: boolean,
  staleHydrated?: boolean,
): { cache: CacheStatus; justWatch: CacheStatus } {
  const staleSuffix = staleHydrated
    ? "\n\nRestored from this tab's last successful poll (React state resets on reload; Redis was not cleared)."
    : "";
  const count = data.watchlistCacheEntries ?? 0;
  const listCount = data.listCacheEntries ?? 0;
  const searchCount = data.searchMovieCacheEntries ?? 0;
  const searchApprox = data.searchMovieApproxStringKeys ?? 0;
  const searchUnindexed = data.searchMovieUnindexedApprox ?? 0;
  return {
    cache: {
      text: `Cache: watchlist ${count}, list ${listCount}, search idx ${searchCount} (~str ${searchApprox}, ~unidx ${searchUnindexed})${isListLoading ? " (loading)" : ""}`,
      tone: cachePillTone(isListLoading, count, listCount, searchCount, searchApprox),
      title: buildCacheStatusTitleFromPayload(data, isListLoading) + staleSuffix,
    },
    justWatch: buildJustWatchStatusFromPayload(data, isListLoading, staleSuffix),
  };
}

function buildCacheStatusTitleFromPayload(data: CacheStatusJson, isListLoading: boolean): string {
  const appPrefix = data.redisKeyPrefix || "app";
  const scanned = data.searchMovieScannedStringKeys;

  return [
    "Dev cache status (Redis):",
    `Redis key prefix (FLY_APP_NAME): ${appPrefix}`,
    `- watchlist: entries tracked in Redis set "${appPrefix}:keys:watchlist" (Letterboxd watchlist page caches).`,
    `- list: entries tracked in "${appPrefix}:keys:list" (Letterboxd list page caches; includes custom lists).`,
    `- search idx: entries tracked in "${appPrefix}:keys:search-movie" (movie search /tile lookup caches).`,
    "- ~str: approximate count of STRING keys whose JSON looks like /api/search-movie payloads (SCAN + heuristic; not perfect).",
    "- ~unidx: max(0, ~str - search idx) — suggests index drift/legacy keys not represented in the category set.",
    ...(typeof scanned === "number" ? [`Scan coverage: scannedStringKeys=${scanned}.`] : []),
    "",
    "Current snapshot:",
    `- watchlist=${data.watchlistCacheEntries ?? 0}, list=${data.listCacheEntries ?? 0}, search idx=${data.searchMovieCacheEntries ?? 0}`,
    `- search ~str=${data.searchMovieApproxStringKeys ?? 0}, ~unidx=${data.searchMovieUnindexedApprox ?? 0}`,
    "",
    "JustWatch HTTP errors (process-local counters):",
    `- total=${data.justWatchHttpErrors?.total ?? 0}`,
    `- byStatus: ${formatJustWatchHttpBreakdown(data.justWatchHttpErrors?.byStatus)}`,
    ...(data.justWatchHttpErrors?.last
      ? [
          `- last: HTTP ${data.justWatchHttpErrors.last.status} at ${data.justWatchHttpErrors.last.at}`,
        ]
      : []),
    ...(data.error ? ["", `Server note: ${data.error}`] : []),
    ...(isListLoading
      ? ["", "UI note: a Letterboxd list/watchlist load is in progress; counts may be mid-flight."]
      : []),
  ].join("\n");
}

/** Shown on the "Next key TTL" hover only (keeps the main cache pill tooltip shorter). */
function buildCacheTtlRowTooltip(data: CacheStatusJson | null): string {
  const d = data ?? ({} as CacheStatusJson);
  const hasTtlEnv =
    typeof d.cacheTtlEnvSeconds === "number" && Number.isFinite(d.cacheTtlEnvSeconds);
  const hasSoonest =
    typeof d.soonestIndexedKeyExpiryAtMs === "number" &&
    Number.isFinite(d.soonestIndexedKeyExpiryAtMs);

  return [
    "Redis TTL (dev):",
    "",
    ...(!data
      ? [
          "No snapshot yet. After /api/dev/cache-status succeeds, this shows CACHE_TTL env and next-key expiry notes.",
          "",
        ]
      : []),
    "Redis key TTL (SET … EX, seconds):",
    ...(hasTtlEnv
      ? [
          `- CACHE_TTL env on this server process: ${d.cacheTtlEnvSeconds}s (used wherever controllers read it; overrides their built-in defaults).`,
          "- Note: /api/search-movie still uses a fixed 120s TTL for the upstream-unavailable tier (not overridden by CACHE_TTL).",
        ]
      : [
          "- CACHE_TTL env is not set (or invalid) on this process. Built-in defaults when unset:",
          "  - Letterboxd list/watchlist page cache: 20s",
          "  - /api/search-movie (success): 3600s; upstream-unavailable tier: 120s (fixed)",
          "  - Alternative search: 3600s",
          "  - OMDB poster, generic proxy cache, Letterboxd poster URLs: 60s",
        ]),
    "",
    "Soonest indexed key expiry (from last poll):",
    ...(hasSoonest
      ? [
          `- Next key with a finite TTL in the watchlist + list + search-movie index sets expires at epoch ms ${d.soonestIndexedKeyExpiryAtMs}.`,
          "- Keys with no expiry (PTTL -1) are ignored; unindexed STRING keys are not scanned here.",
        ]
      : ["- No expiring indexed keys right now, or TTL snapshot unavailable."]),
    "",
    "Countdown row:",
    "- The number counts down seconds until that soonest EX expiry (client ticks every second; anchor refreshes each /api/dev/cache-status poll).",
    "- Keys not in those three index sets are not included.",
  ].join("\n");
}

async function devPostAlert(
  path: string,
  okMessage: (data: DevPostJson) => string,
  failPrefix: string,
): Promise<boolean> {
  try {
    const r = await fetch(path, { method: "POST" });
    const data = (await r.json()) as DevPostJson;
    if (r.ok) {
      globalThis.alert(okMessage(data));
      return true;
    } else {
      globalThis.alert(data.error || failPrefix);
      return false;
    }
  } catch (e) {
    globalThis.alert(failPrefix + ": " + (e as Error).message);
    return false;
  }
}

function DebugBarIconEraser(): React.ReactElement {
  return (
    <svg
      className="debug-bar__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 21h8M5.7 10.3l6-6a2.4 2.4 0 0 1 3.4 0l4.6 4.6a2.4 2.4 0 0 1 0 3.4l-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 21h6l10-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DebugBarIconPlay(): React.ReactElement {
  return (
    <svg
      className="debug-bar__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9.5 7.5v9l7.5-4.5-7.5-4.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DebugBarIconReset(): React.ReactElement {
  return (
    <svg
      className="debug-bar__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 12a9 9 0 0 1 15.5-6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 4v6h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DebugBarIconDownload(): React.ReactElement {
  return (
    <svg
      className="debug-bar__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 14l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DebugBarHoverTip(
  props: Readonly<{ tip: string; children: React.ReactNode }>,
): React.ReactElement {
  return (
    <>
      {props.children}
      <span className="debug-bar__tip" aria-hidden="true">
        {props.tip}
      </span>
    </>
  );
}

export function DevDebugBar(): React.ReactElement | null {
  const dev = isDevDebugBarEnabled();
  const { isListLoading, loadLetterboxdListWithSyncedUrl } = useAppState();
  const actionsDisabled = isListLoading;
  const [cacheStatus, setCacheStatus] = React.useState<CacheStatus>(() => {
    const stored = readStoredCacheStatusPayload();
    if (stored) return deriveCacheStatusesFromPayload(stored, false, true).cache;
    return {
      text: "Cache: checking...",
      tone: "neutral",
      title:
        "Fetching /api/dev/cache-status…\n\nThis polls Redis category index sets (and runs a heavier SCAN estimate for search-movie-shaped STRING keys).",
    };
  });
  const [justWatchStatus, setJustWatchStatus] = React.useState<CacheStatus>(() => {
    const stored = readStoredCacheStatusPayload();
    if (stored) return deriveCacheStatusesFromPayload(stored, false, true).justWatch;
    return {
      text: "JW errs: checking...",
      tone: "neutral",
      title:
        "Fetching /api/dev/cache-status…\n\nJustWatch HTTP error counters are included in the same JSON payload as Redis cache diagnostics.",
    };
  });
  const [pollCountdownSeconds, setPollCountdownSeconds] = React.useState(
    Math.ceil(CACHE_STATUS_POLL_MS_IDLE / 1000),
  );
  const [soonestIndexedKeyExpiryAtMs, setSoonestIndexedKeyExpiryAtMs] = React.useState<
    number | null
  >(() => parseSoonestIndexedKeyExpiryAtMs(readStoredCacheStatusPayload() ?? {}));
  const [ttlTooltipSource, setTtlTooltipSource] = React.useState<CacheStatusJson | null>(() =>
    readStoredCacheStatusPayload(),
  );
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const refreshWatchlistCacheStatus = React.useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch(`${DEV_HTTP_API_PREFIX}/cache-status`, { cache: "no-store" });
      const data = (await r.json()) as CacheStatusJson;
      if (!r.ok || data.ok === false) {
        setTtlTooltipSource(null);
        setSoonestIndexedKeyExpiryAtMs(null);
        setCacheStatus({
          text: "Cache: status unavailable",
          tone: "error",
          title:
            "Could not read /api/dev/cache-status.\n\nCommon causes: dev server not running, dev routes blocked, Redis unreachable, or DISABLE_REDIS enabled." +
            (data.error ? `\n\nServer error: ${data.error}` : ""),
        });
        setJustWatchStatus({
          text: "JW errs: unavailable",
          tone: "error",
          title:
            "Could not read JustWatch counters from /api/dev/cache-status.\n\nFix cache-status first; these counters are process-local and reset on server restart.",
        });
        return false;
      }
      const { cache, justWatch } = deriveCacheStatusesFromPayload(data, isListLoading, false);
      setCacheStatus(cache);
      setJustWatchStatus(justWatch);
      setTtlTooltipSource(data);
      setSoonestIndexedKeyExpiryAtMs(parseSoonestIndexedKeyExpiryAtMs(data));
      persistCacheStatusPayload(data);
      return true;
    } catch {
      setTtlTooltipSource(null);
      setSoonestIndexedKeyExpiryAtMs(null);
      setCacheStatus({
        text: "Cache: status unavailable",
        tone: "error",
        title:
          "Network error while calling /api/dev/cache-status.\n\nIf the backend restarted, wait a moment and hover again after the next poll.",
      });
      setJustWatchStatus({
        text: "JW errs: unavailable",
        tone: "error",
        title:
          "Network error while calling /api/dev/cache-status.\n\nJustWatch counters ride along with that endpoint.",
      });
      return false;
    }
  }, [isListLoading]);

  useEffect(() => {
    if (!dev) return;
    document.body.classList.add("has-dev-debug-bar");
    refreshWatchlistCacheStatus().catch(() => {
      /* initial poll errors reflected in pill state */
    });
    return () => {
      document.body.classList.remove("has-dev-debug-bar");
    };
  }, [dev, refreshWatchlistCacheStatus]);

  useEffect(() => {
    if (!dev) return;
    const id = globalThis.setInterval(() => setNowMs(Date.now()), 1000);
    return () => globalThis.clearInterval(id);
  }, [dev]);

  useEffect(() => {
    if (!dev) return;
    const pollMs = isListLoading ? CACHE_STATUS_POLL_MS_LOADING : CACHE_STATUS_POLL_MS_IDLE;
    let remainingMs = pollMs;
    setPollCountdownSeconds(Math.ceil(pollMs / 1000));

    const countdownTimer = globalThis.setInterval(() => {
      remainingMs = Math.max(0, remainingMs - 1_000);
      setPollCountdownSeconds(Math.ceil(remainingMs / 1000));
    }, 1_000);

    const timer = globalThis.setInterval(() => {
      refreshWatchlistCacheStatus().catch(() => {
        /* errors reflected in cache pill */
      });
      remainingMs = pollMs;
      setPollCountdownSeconds(Math.ceil(pollMs / 1000));
    }, pollMs);
    return () => {
      globalThis.clearInterval(timer);
      globalThis.clearInterval(countdownTimer);
    };
  }, [dev, isListLoading, refreshWatchlistCacheStatus]);

  if (!dev) return null;

  const nextKeyTtlSec =
    soonestIndexedKeyExpiryAtMs == null
      ? null
      : Math.max(0, Math.ceil((soonestIndexedKeyExpiryAtMs - nowMs) / 1000));

  async function withCacheStatus(pendingLabel: string, fn: () => Promise<boolean>): Promise<void> {
    setCacheStatus({
      text: `Cache: ${pendingLabel}`,
      tone: "progress",
      title: `Operation in progress: ${pendingLabel}\n\nCounts may be stale until this finishes and the next /api/dev/cache-status refresh runs.`,
    });
    setJustWatchStatus((prev) => ({ ...prev, tone: "progress" }));
    const didSucceed = await fn();
    if (!didSucceed) {
      setCacheStatus({
        text: "Cache: failed",
        tone: "error",
        title:
          "The last dev cache operation failed.\n\nCheck the alert dialog for details, then hover the status pill again after the next poll.",
      });
      setJustWatchStatus({
        text: "JW errs: stale",
        tone: "error",
        title:
          "Could not refresh JustWatch counters after a failed dev cache operation.\n\nWait for the next /api/dev/cache-status poll or reload the page.",
      });
      return;
    }
    // After POST /api/dev/* the backend may restart (e.g. nodemon). Retry cache-status so the
    // UI does not briefly error while the proxy target comes back.
    const cacheStatusRetries = 8;
    const cacheStatusRetryDelayMs = 400;
    for (let attempt = 0; attempt < cacheStatusRetries; attempt++) {
      if (attempt > 0) await sleep(cacheStatusRetryDelayMs);
      if (await refreshWatchlistCacheStatus()) return;
    }
  }

  return (
    <section className="debug-bar" aria-label="Development tools" data-testid="dev-debug-bar">
      <span className="debug-bar__label">Dev</span>
      <span className="debug-bar__origin debug-bar__tip-host" data-testid="dev-debug-origin">
        Origin: {globalThis.location?.origin ?? "—"}
        <span className="debug-bar__tip" aria-hidden="true">
          Same-origin <code>/api/*</code> (Vite proxies <code>/api</code> to Fastify on port 3000).
          If JustWatch is blocked server-side, <code>POST /api/search-movie</code> still returns
          HTTP 200 with JSON <code>error</code> — open that request in Network and check Response
          Headers: <code>X-JustWatch-Upstream-Status</code>, <code>X-JustWatch-Used-Proxy</code>.
        </span>
      </span>
      <div className="debug-bar__actions">
        <span className="debug-bar__tip-host">
          <DebugBarHoverTip tip="Clears Redis category `list` (Letterboxd list page caches). Does not rebuild from snapshot.">
            <button
              type="button"
              className="btn btn-secondary dev-clear-cache"
              data-testid="dev-clear-list-cache"
              disabled={actionsDisabled}
              onClick={() => {
                withCacheStatus("clearing", () =>
                  devPostAlert(
                    `${DEV_HTTP_API_PREFIX}/clear-list-cache`,
                    (data) => `Cleared ${data.cleared ?? 0} list cache entries.`,
                    "Failed to clear cache",
                  ),
                ).catch(() => {
                  /* withCacheStatus handles UI state */
                });
              }}
            >
              <span className="debug-bar__btn-inner">
                <DebugBarIconEraser />
                <span>Clear list cache</span>
              </span>
            </button>
          </DebugBarHoverTip>
        </span>
        <span className="debug-bar__tip-host">
          <DebugBarHoverTip tip="Loads a fixed dummy public watchlist through the normal app flow (scrapes Letterboxd + kicks off per-title searches).">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="dev-load-dummy-watchlist"
              disabled={actionsDisabled}
              onClick={() => {
                setCacheStatus({
                  text: "Cache: loading watchlist...",
                  tone: "progress",
                  title:
                    "Loading the dummy Letterboxd watchlist pages and then searching each title.\n\nWatch Redis counters update as pages and searches get cached.",
                });
                setJustWatchStatus((prev) => ({ ...prev, tone: "progress" }));
                const url = "https://letterboxd.com/oobbvvss/watchlist/";
                loadLetterboxdListWithSyncedUrl(url);
                refreshWatchlistCacheStatus().catch(() => {
                  /* errors reflected in cache pill */
                });
              }}
            >
              <span className="debug-bar__btn-inner">
                <DebugBarIconPlay />
                <span>Load dummy watchlist</span>
              </span>
            </button>
          </DebugBarHoverTip>
        </span>
        <span className="debug-bar__tip-host">
          <DebugBarHoverTip tip="Runs `bun run redis:reset` (validate + seed from redis snapshot). Restores baseline dev Redis, not an empty wipe.">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="dev-reset-redis-cache"
              disabled={actionsDisabled}
              onClick={() => {
                withCacheStatus("resetting", () =>
                  devPostAlert(
                    `${DEV_HTTP_API_PREFIX}/reset-redis`,
                    (data) => data.stdout?.trim() || "Redis cache reset from validated snapshot.",
                    "Failed to reset Redis cache",
                  ),
                ).catch(() => {
                  /* withCacheStatus handles UI state */
                });
              }}
            >
              <span className="debug-bar__btn-inner">
                <DebugBarIconReset />
                <span>Reset Redis cache</span>
              </span>
            </button>
          </DebugBarHoverTip>
        </span>
        <span className="debug-bar__tip-host">
          <DebugBarHoverTip tip="Runs `bun run export-redis` to write redis/data/redis-snapshot.json from current local Redis (read-only export).">
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="dev-export-redis-snapshot"
              disabled={actionsDisabled}
              onClick={() => {
                withCacheStatus("exporting", () =>
                  devPostAlert(
                    `${DEV_HTTP_API_PREFIX}/export-redis`,
                    (data) => data.stdout?.trim() || "Redis snapshot exported.",
                    "Failed to export Redis snapshot",
                  ),
                ).catch(() => {
                  /* withCacheStatus handles UI state */
                });
              }}
            >
              <span className="debug-bar__btn-inner">
                <DebugBarIconDownload />
                <span>Export Redis snapshot</span>
              </span>
            </button>
          </DebugBarHoverTip>
        </span>
      </div>
      <span
        className={`debug-bar__cache-status debug-bar__cache-status--${cacheStatus.tone} debug-bar__tip-host`}
        data-testid="dev-cache-status"
      >
        {cacheStatus.text}
        <span className="debug-bar__tip" aria-hidden="true">
          {cacheStatus.title}
        </span>
      </span>
      <span
        className={`debug-bar__cache-status debug-bar__cache-status--${justWatchStatus.tone} debug-bar__tip-host`}
        data-testid="dev-justwatch-http-errors"
      >
        {justWatchStatus.text}
        <span className="debug-bar__tip" aria-hidden="true">
          {justWatchStatus.title}
        </span>
      </span>
      <span
        className="debug-bar__cache-poll debug-bar__tip-host"
        data-testid="dev-cache-poll-countdown"
      >
        Next poll in{" "}
        <span className="debug-bar__cache-poll-count" aria-live="polite">
          {`${pollCountdownSeconds}s`}
        </span>
        <span className="debug-bar__tip" aria-hidden="true">
          Time until the next automatic /api/dev/cache-status refresh. Faster while a list/watchlist
          load is active.
        </span>
      </span>
      <span
        className="debug-bar__cache-ttl debug-bar__tip-host"
        data-testid="dev-cache-ttl-countdown"
      >
        Next key TTL in{" "}
        {nextKeyTtlSec == null ? (
          <span className="debug-bar__cache-ttl-na">—</span>
        ) : (
          <span className="debug-bar__cache-ttl-count" aria-live="polite">
            {`${nextKeyTtlSec}s`}
          </span>
        )}
        <span className="debug-bar__tip" aria-hidden="true">
          {buildCacheTtlRowTooltip(ttlTooltipSource)}
        </span>
      </span>
    </section>
  );
}
