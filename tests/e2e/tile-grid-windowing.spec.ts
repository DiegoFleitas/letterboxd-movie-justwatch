import { test, expect, type Page } from "@playwright/test";
import {
  letterboxdFixtures,
  mockGeoIpRoute,
  type SearchMovieBody,
  waitForGeoReady,
} from "./app-test-helpers.js";

/**
 * Smoke test for the windowed tile grid. Proves the windowing works: with 300
 * tiles only a viewport-sized slice is in the DOM, and scrolling swaps in
 * different tiles — on both the desktop (`.right-panel`) and mobile (window)
 * scrollers.
 */
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

async function loadList(page: Page): Promise<void> {
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
}

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("Windowed tile grid", () => {
  // scrollKind: "panel" = desktop (`.right-panel` scrolls); "window" = mobile.
  for (const { name, viewport, scrollKind } of [
    {
      name: "desktop (panel scroller)",
      viewport: { width: 1280, height: 800 },
      scrollKind: "panel",
    },
    {
      name: "mobile (window scroller)",
      viewport: { width: 390, height: 800 },
      scrollKind: "window",
    },
  ] as const) {
    test(`windows the grid and reveals tiles on scroll — ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loadList(page);

      const tiles = page.getByTestId("poster-showcase").getByTestId("tile");
      await expect(tiles.first()).toBeVisible({ timeout: 30_000 });

      // Windowing: far fewer than TILE_COUNT tiles are mounted at once.
      const mounted = await tiles.count();
      console.log(`[virtualize] ${name}: mounted ${mounted} of ${TILE_COUNT} tiles`);
      expect(mounted).toBeGreaterThan(0);
      expect(mounted).toBeLessThan(TILE_COUNT / 2);

      // Scroll the correct scroller for this breakpoint, confirm the window moved.
      const firstId = await tiles.first().getAttribute("data-id");
      await page.evaluate((kind) => {
        if (kind === "window") window.scrollTo({ top: 4000 });
        else document.querySelector(".right-panel")?.scrollTo({ top: 4000 });
      }, scrollKind);

      // Retry until the virtualizer recomputes its window (avoids a fixed-wait race).
      await expect(async () => {
        const idsAfterScroll = await tiles.evaluateAll((els) =>
          els.map((e) => e.getAttribute("data-id")),
        );
        expect(idsAfterScroll).not.toContain(firstId);
      }).toPass({ timeout: 5000 });
    });
  }
});
