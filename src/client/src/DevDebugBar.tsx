import React, { useEffect } from "react";
import { DEV_HTTP_API_PREFIX } from "@devHttpApiPrefix";
import { useAppState } from "./AppStateContext";
import { isViteDev } from "./devDebugBarEnv";
import "./DevDebugBar.css";

type DevPostJson = { ok?: boolean; error?: string; cleared?: number; stdout?: string };

async function devPostAlert(
  path: string,
  okMessage: (data: DevPostJson) => string,
  failPrefix: string,
): Promise<void> {
  try {
    const r = await fetch(path, { method: "POST" });
    const data = (await r.json()) as DevPostJson;
    if (r.ok) {
      window.alert(okMessage(data));
    } else {
      window.alert(data.error || failPrefix);
    }
  } catch (e) {
    window.alert(failPrefix + ": " + (e as Error).message);
  }
}

export function DevDebugBar(): React.ReactElement | null {
  const dev = isViteDev();
  const { isListLoading, loadLetterboxdListWithSyncedUrl } = useAppState();

  useEffect(() => {
    if (!dev) return;
    document.body.classList.add("has-dev-debug-bar");
    return () => {
      document.body.classList.remove("has-dev-debug-bar");
    };
  }, [dev]);

  if (!dev) return null;

  return (
    <div
      className="debug-bar"
      role="region"
      aria-label="Development tools"
      data-testid="dev-debug-bar"
    >
      <span className="debug-bar__label">Dev</span>
      <div className="debug-bar__actions">
        <button
          type="button"
          className="btn btn-secondary dev-clear-cache"
          data-testid="dev-clear-list-cache"
          disabled={isListLoading}
          onClick={() =>
            void devPostAlert(
              `${DEV_HTTP_API_PREFIX}/clear-list-cache`,
              (data) => `Cleared ${data.cleared ?? 0} list cache entries.`,
              "Failed to clear cache",
            )
          }
        >
          Clear list cache (dev)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="dev-load-eibonslam-watchlist"
          disabled={isListLoading}
          onClick={() => {
            const url = "https://letterboxd.com/eibonslam/watchlist";
            loadLetterboxdListWithSyncedUrl(url);
          }}
        >
          Load eibonslam watchlist (dev)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="dev-seed-redis-snapshot"
          disabled={isListLoading}
          onClick={() =>
            void devPostAlert(
              `${DEV_HTTP_API_PREFIX}/seed-redis`,
              (data) => data.stdout?.trim() || "Redis seeded from snapshot.",
              "Failed to seed Redis",
            )
          }
        >
          Seed Redis snapshot (dev)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="dev-export-redis-snapshot"
          disabled={isListLoading}
          onClick={() =>
            void devPostAlert(
              `${DEV_HTTP_API_PREFIX}/export-redis`,
              (data) => data.stdout?.trim() || "Redis snapshot exported.",
              "Failed to export Redis snapshot",
            )
          }
        >
          Export Redis snapshot (dev)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="dev-validate-redis-snapshot"
          disabled={isListLoading}
          onClick={() =>
            void devPostAlert(
              `${DEV_HTTP_API_PREFIX}/validate-redis-snapshot`,
              (data) => data.stdout?.trim() || "Redis snapshot is valid.",
              "Failed to validate Redis snapshot",
            )
          }
        >
          Validate Redis snapshot (dev)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="dev-refresh-local-seed"
          disabled={isListLoading}
          onClick={() =>
            void devPostAlert(
              `${DEV_HTTP_API_PREFIX}/refresh-local-seed`,
              (data) => data.stdout?.trim() || "Redis snapshot refreshed.",
              "Failed to refresh Redis snapshot",
            )
          }
        >
          Refresh Redis snapshot (dev)
        </button>
      </div>
    </div>
  );
}
