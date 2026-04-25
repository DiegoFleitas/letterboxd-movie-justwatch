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
