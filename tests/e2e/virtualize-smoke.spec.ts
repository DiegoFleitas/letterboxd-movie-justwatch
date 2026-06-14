import { test, expect } from "@playwright/test";
import {
  letterboxdFixtures,
  mockGeoIpRoute,
  type SearchMovieBody,
  waitForGeoReady,
} from "./app-test-helpers.js";

/**
 * Spike-only smoke test for the windowed tile grid (VITE_VIRTUALIZE=1).
 * Run with the flag enabled, e.g.:
 *   VITE_VIRTUALIZE=1 bunx playwright test tests/e2e/virtualize-smoke.spec.ts
 *
 * Proves the windowing actually works: with 300 tiles only a viewport-sized
 * slice is in the DOM, and scrolling swaps in different tiles. Skips itself
 * when the flag is off so it does not fail the normal (animated-grid) suite.
 */
const VIRTUALIZED = process.env.VITE_VIRTUALIZE === "1";
const TILE_COUNT = 300;

const PROVIDER = {
  id: "disneyplus",
  name: "Disney Plus",
  icon: "https://images.justwatch.com/icon/313118777/s100/disneyplus.jpg",
  url: "https://example.com/disney",
  type: "FLATRATE",
};

function expandFixture(tileCount: number) {
  const base = JSON.parse(JSON.stringify(letterboxdFixtures));
  const baseList = base[0].response.watchlist;
  const expanded = [];
  for (let i = 0; i < tileCount; i++) {
    const entry = { ...baseList[i % baseList.length] };
    entry.title = `${entry.title} #${i}`;
    entry.year = String(Number(entry.year ?? 2024) + Math.floor(i / baseList.length));
    expanded.push(entry);
  }
  base[0].response.watchlist = expanded;
  return base;
}

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("Virtualized tile grid (spike)", () => {
  test.skip(!VIRTUALIZED, "requires VITE_VIRTUALIZE=1");

  test("windows the grid and reveals tiles on scroll", async ({ page }) => {
    const fixture = expandFixture(TILE_COUNT);
    await page.route("**/api/letterboxd-watchlist", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture[0].response),
      }),
    );
    await page.route("**/api/search-movie", (route) => {
      const body = route.request().postDataJSON() as SearchMovieBody | null;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Movie found",
          movieProviders: [PROVIDER],
          title: body?.title,
          year: body?.year,
          poster: "",
        }),
      });
    });

    await page.goto("/");
    await waitForGeoReady(page);
    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://letterboxd.com/user/watchlist/");
    await page.getByTestId("list-submit").click();

    const tiles = page.getByTestId("poster-showcase").getByTestId("tile");
    await expect(tiles.first()).toBeVisible({ timeout: 30_000 });

    // Windowing: far fewer than TILE_COUNT tiles are mounted at once.
    const mounted = await tiles.count();

    console.log(`[virtualize] mounted ${mounted} of ${TILE_COUNT} tiles`);
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(TILE_COUNT / 2);

    // Capture the first tile's id, scroll down, and confirm the window moved.
    const firstId = await tiles.first().getAttribute("data-id");
    await page.evaluate(() => {
      const scroller = document.querySelector(".right-panel");
      if (scroller) scroller.scrollTo({ top: 4000 });
    });
    await page.waitForTimeout(300);

    const idsAfterScroll = await tiles.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-id")),
    );
    expect(idsAfterScroll).not.toContain(firstId);
  });
});
