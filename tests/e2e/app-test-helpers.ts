/**
 * Shared Playwright helpers and fixture data for UI E2E specs (mocked `/api/*`).
 * @see tests/e2e/README.md
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { expect, type Page } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures", "api");

export const letterboxdFixtures = JSON.parse(
  readFileSync(join(fixturesDir, "letterboxd-watchlist.json"), "utf-8"),
) as { response: { watchlist: { title?: string }[] } }[];

export const searchMovieFixtures = JSON.parse(
  readFileSync(join(fixturesDir, "search-movie.json"), "utf-8"),
) as {
  request?: { title?: string; year?: string | number; country?: string };
  response: unknown;
}[];

export interface SearchMovieBody {
  title?: string;
  year?: string | number;
  country?: string;
}

export function findSearchMovieResponse(body: SearchMovieBody | null): unknown {
  const t = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  const entry = searchMovieFixtures.find(
    (f) =>
      t(f.request?.title) === t(body?.title) &&
      t(f.request?.year) === t(body?.year) &&
      t(f.request?.country) === t(body?.country),
  );
  return entry ? entry.response : null;
}

/** Wait for automatic geo to complete so the country selector is stable (mock returns UY). */
export async function waitForGeoReady(page: Page): Promise<void> {
  const selector = page.getByTestId("country-selector");
  await expect(selector).toBeAttached({ timeout: 5000 });
  // Native <select> options also contain "Uruguay"; target the combobox trigger only.
  await expect(selector.getByRole("button", { name: "Uruguay" })).toBeVisible({ timeout: 5000 });
}

/** Stub ipapi so country auto-detection is deterministic in every spec. */
export async function mockGeoIpRoute(page: Page): Promise<void> {
  await page.route("**/ipapi.co/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ country_code: "UY", ip: "127.0.0.1" }),
    }),
  );
}

/**
 * Install a scroll addEventListener interceptor that records the target
 * element and handler body for every scroll listener registered during
 * the page lifecycle. Later, callers query `window.__scrollListenerInfo`
 * to verify which element the pagination handler was attached to.
 * Callers query `globalThis.__scrollListenerInfo` at test time.
 */
export async function setupScrollListenerInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = EventTarget.prototype.addEventListener;
    const info: Array<{ target: string; handlerBody: string }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__scrollListenerInfo = info;

    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === "scroll" && typeof listener === "function") {
        const targetName =
          this === globalThis
            ? "window"
            : (this as Element).className || (this as Element).tagName || "unknown";
        info.push({ target: targetName, handlerBody: listener.toString().slice(0, 300) });
      }
      return original.call(this, type, listener, options);
    };
  });
}

/** Mock the letterboxd-watchlist and search-movie API routes for pagination tests. */
export async function mockListAndSearchRoutes(page: Page): Promise<void> {
  await page.route("**/api/letterboxd-watchlist", (route) => {
    const baseList = letterboxdFixtures[0]?.response.watchlist ?? [];
    const watchlist = baseList.map((e) => ({ ...e }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "List found",
        watchlist,
        lastPage: 1,
        totalPages: 5,
        hasMore: true,
      }),
    });
  });

  await page.route("**/api/search-movie", (route) => {
    const body = route.request().postDataJSON() as SearchMovieBody | null;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Movie found",
        movieProviders: [],
        title: body?.title,
        year: body?.year,
      }),
    });
  });
}
