import React, { useEffect } from "react";
import { DEV_HTTP_API_PREFIX } from "@server/routes";
import { useAppState } from "./AppStateContext";
import { isViteDev } from "./devDebugBarEnv";
import "./DevDebugBar.css";

type DevPostJson = { ok?: boolean; error?: string; cleared?: number; stdout?: string };
type CacheStatusJson = {
  ok?: boolean;
  error?: string;
  redisKeyPrefix?: string;
  watchlistCacheEntries?: number;
  hasWatchlistCache?: boolean;
  listCacheEntries?: number;
  hasListCache?: boolean;
  searchMovieCacheEntries?: number;
  hasSearchMovieCache?: boolean;
  searchMovieApproxStringKeys?: number;
  searchMovieScannedStringKeys?: number;
  searchMovieUnindexedApprox?: number;
};
type CacheStatusTone = "neutral" | "progress" | "ok" | "error";
type CacheStatus = { text: string; tone: CacheStatusTone; title: string };
const CACHE_STATUS_POLL_MS_IDLE = 15_000;
const CACHE_STATUS_POLL_MS_LOADING = 2_500;

function buildCacheStatusTitleFromPayload(data: CacheStatusJson, isListLoading: boolean): string {
  const lines: string[] = [];
  const appPrefix = data.redisKeyPrefix || "app";

  lines.push("Dev cache status (Redis):");
  lines.push(`Redis key prefix (FLY_APP_NAME): ${appPrefix}`);
  lines.push(
    `- watchlist: entries tracked in Redis set "${appPrefix}:keys:watchlist" (Letterboxd watchlist page caches).`,
  );
  lines.push(
    `- list: entries tracked in "${appPrefix}:keys:list" (Letterboxd list page caches; includes custom lists).`,
  );
  lines.push(
    `- search idx: entries tracked in "${appPrefix}:keys:search-movie" (movie search /tile lookup caches).`,
  );
  lines.push(
    "- ~str: approximate count of STRING keys whose JSON looks like /api/search-movie payloads (SCAN + heuristic; not perfect).",
  );
  lines.push(
    "- ~unidx: max(0, ~str - search idx) — suggests index drift/legacy keys not represented in the category set.",
  );

  const scanned = data.searchMovieScannedStringKeys;
  if (typeof scanned === "number") {
    lines.push(`Scan coverage: scannedStringKeys=${scanned}.`);
  }

  lines.push("");
  lines.push("Current snapshot:");
  lines.push(
    `- watchlist=${data.watchlistCacheEntries ?? 0}, list=${data.listCacheEntries ?? 0}, search idx=${data.searchMovieCacheEntries ?? 0}`,
  );
  lines.push(
    `- search ~str=${data.searchMovieApproxStringKeys ?? 0}, ~unidx=${data.searchMovieUnindexedApprox ?? 0}`,
  );

  if (data.error) {
    lines.push("");
    lines.push(`Server note: ${data.error}`);
  }

  if (isListLoading) {
    lines.push("");
    lines.push(
      "UI note: a Letterboxd list/watchlist load is in progress; counts may be mid-flight.",
    );
  }

  return lines.join("\n");
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
      window.alert(okMessage(data));
      return true;
    } else {
      window.alert(data.error || failPrefix);
      return false;
    }
  } catch (e) {
    window.alert(failPrefix + ": " + (e as Error).message);
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

function DebugBarHoverTip(props: { tip: string; children: React.ReactNode }): React.ReactElement {
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
  const dev = isViteDev();
  const { isListLoading, loadLetterboxdListWithSyncedUrl } = useAppState();
  const actionsDisabled = isListLoading;
  const [cacheStatus, setCacheStatus] = React.useState<CacheStatus>({
    text: "Cache: checking...",
    tone: "neutral",
    title:
      "Fetching /api/dev/cache-status…\n\nThis polls Redis category index sets (and runs a heavier SCAN estimate for search-movie-shaped STRING keys).",
  });
  const [pollCountdownSeconds, setPollCountdownSeconds] = React.useState(
    Math.ceil(CACHE_STATUS_POLL_MS_IDLE / 1000),
  );

  const refreshWatchlistCacheStatus = React.useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch(`${DEV_HTTP_API_PREFIX}/cache-status`, { cache: "no-store" });
      const data = (await r.json()) as CacheStatusJson;
      if (!r.ok || data.ok === false) {
        setCacheStatus({
          text: "Cache: status unavailable",
          tone: "error",
          title:
            "Could not read /api/dev/cache-status.\n\nCommon causes: dev server not running, dev routes blocked, Redis unreachable, or DISABLE_REDIS enabled." +
            (data.error ? `\n\nServer error: ${data.error}` : ""),
        });
        return false;
      }
      const count = data.watchlistCacheEntries ?? 0;
      const listCount = data.listCacheEntries ?? 0;
      const searchCount = data.searchMovieCacheEntries ?? 0;
      const searchApprox = data.searchMovieApproxStringKeys ?? 0;
      const searchUnindexed = data.searchMovieUnindexedApprox ?? 0;
      setCacheStatus({
        text: `Cache: watchlist ${count}, list ${listCount}, search idx ${searchCount} (~str ${searchApprox}, ~unidx ${searchUnindexed})${isListLoading ? " (loading)" : ""}`,
        tone: isListLoading
          ? "progress"
          : count > 0 || listCount > 0 || searchCount > 0 || searchApprox > 0
            ? "ok"
            : "neutral",
        title: buildCacheStatusTitleFromPayload(data, isListLoading),
      });
      return true;
    } catch {
      setCacheStatus({
        text: "Cache: status unavailable",
        tone: "error",
        title:
          "Network error while calling /api/dev/cache-status.\n\nIf the backend restarted, wait a moment and hover again after the next poll.",
      });
      return false;
    }
  }, [isListLoading]);

  useEffect(() => {
    if (!dev) return;
    document.body.classList.add("has-dev-debug-bar");
    void refreshWatchlistCacheStatus();
    return () => {
      document.body.classList.remove("has-dev-debug-bar");
    };
  }, [dev, refreshWatchlistCacheStatus]);

  useEffect(() => {
    if (!dev) return;
    const pollMs = isListLoading ? CACHE_STATUS_POLL_MS_LOADING : CACHE_STATUS_POLL_MS_IDLE;
    let remainingMs = pollMs;
    setPollCountdownSeconds(Math.ceil(pollMs / 1000));

    const countdownTimer = window.setInterval(() => {
      remainingMs = Math.max(0, remainingMs - 1_000);
      setPollCountdownSeconds(Math.ceil(remainingMs / 1000));
    }, 1_000);

    const timer = window.setInterval(() => {
      void refreshWatchlistCacheStatus();
      remainingMs = pollMs;
      setPollCountdownSeconds(Math.ceil(pollMs / 1000));
    }, pollMs);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(countdownTimer);
    };
  }, [dev, isListLoading, refreshWatchlistCacheStatus]);

  if (!dev) return null;

  async function withCacheStatus(pendingLabel: string, fn: () => Promise<boolean>): Promise<void> {
    setCacheStatus({
      text: `Cache: ${pendingLabel}`,
      tone: "progress",
      title: `Operation in progress: ${pendingLabel}\n\nCounts may be stale until this finishes and the next /api/dev/cache-status refresh runs.`,
    });
    const didSucceed = await fn();
    if (!didSucceed) {
      setCacheStatus({
        text: "Cache: failed",
        tone: "error",
        title:
          "The last dev cache operation failed.\n\nCheck the alert dialog for details, then hover the status pill again after the next poll.",
      });
      return;
    }
    await refreshWatchlistCacheStatus();
  }

  return (
    <div
      className="debug-bar"
      role="region"
      aria-label="Development tools"
      data-testid="dev-debug-bar"
    >
      <span className="debug-bar__label">Dev</span>
      <div className="debug-bar__actions">
        <span className="debug-bar__tip-host">
          <DebugBarHoverTip tip="Clears Redis category `list` (Letterboxd list page caches). Does not rebuild from snapshot.">
            <button
              type="button"
              className={`btn btn-secondary dev-clear-cache${actionsDisabled ? " is-disabled" : ""}`}
              data-testid="dev-clear-list-cache"
              aria-disabled={actionsDisabled}
              onClick={() => {
                if (actionsDisabled) return;
                void withCacheStatus("clearing", () =>
                  devPostAlert(
                    `${DEV_HTTP_API_PREFIX}/clear-list-cache`,
                    (data) => `Cleared ${data.cleared ?? 0} list cache entries.`,
                    "Failed to clear cache",
                  ),
                );
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
              className={`btn btn-secondary${actionsDisabled ? " is-disabled" : ""}`}
              data-testid="dev-load-dummy-watchlist"
              aria-disabled={actionsDisabled}
              onClick={() => {
                if (actionsDisabled) return;
                setCacheStatus({
                  text: "Cache: loading watchlist...",
                  tone: "progress",
                  title:
                    "Loading the dummy Letterboxd watchlist pages and then searching each title.\n\nWatch Redis counters update as pages and searches get cached.",
                });
                const url = "https://letterboxd.com/oobbvvss/watchlist/";
                loadLetterboxdListWithSyncedUrl(url);
                void refreshWatchlistCacheStatus();
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
              className={`btn btn-secondary${actionsDisabled ? " is-disabled" : ""}`}
              data-testid="dev-reset-redis-cache"
              aria-disabled={actionsDisabled}
              onClick={() => {
                if (actionsDisabled) return;
                void withCacheStatus("resetting", () =>
                  devPostAlert(
                    `${DEV_HTTP_API_PREFIX}/reset-redis`,
                    (data) => data.stdout?.trim() || "Redis cache reset from validated snapshot.",
                    "Failed to reset Redis cache",
                  ),
                );
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
              className={`btn btn-secondary${actionsDisabled ? " is-disabled" : ""}`}
              data-testid="dev-export-redis-snapshot"
              aria-disabled={actionsDisabled}
              onClick={() => {
                if (actionsDisabled) return;
                void withCacheStatus("exporting", () =>
                  devPostAlert(
                    `${DEV_HTTP_API_PREFIX}/export-redis`,
                    (data) => data.stdout?.trim() || "Redis snapshot exported.",
                    "Failed to export Redis snapshot",
                  ),
                );
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
        className="debug-bar__cache-poll debug-bar__tip-host"
        data-testid="dev-cache-poll-countdown"
      >
        Next poll in {pollCountdownSeconds}s
        <span className="debug-bar__tip" aria-hidden="true">
          Time until the next automatic /api/dev/cache-status refresh. Faster while a list/watchlist
          load is active.
        </span>
      </span>
    </div>
  );
}
