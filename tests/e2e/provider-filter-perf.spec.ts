import { test, expect } from "@playwright/test";
import { letterboxdFixtures, mockGeoIpRoute, waitForGeoReady } from "./app-test-helpers.js";

/**
 * Expand a fixture to tileCount entries by cycling through the base data
 * and appending a counter to each title to ensure unique tile IDs.
 */
function expandFixture(tileCount: number) {
  const base = JSON.parse(JSON.stringify(letterboxdFixtures));
  const baseList = base[0].response.watchlist;
  const expanded = [];
  for (let i = 0; i < tileCount; i++) {
    const entry = { ...baseList[i % baseList.length] };
    entry.title = `${entry.title} #${i}`;
    const baseYear = Number(entry.year ?? 2024);
    entry.year = String(baseYear + Math.floor(i / baseList.length));
    expanded.push(entry);
  }
  base[0].response.watchlist = expanded;
  return base;
}

const TILE_COUNT = 200;

test.beforeEach(async ({ page }) => {
  await mockGeoIpRoute(page);
});

test.describe("Provider filter performance", () => {
  test("filter toggle latency with 200 tiles", async ({ page }) => {
    const fixture = expandFixture(TILE_COUNT);

    await page.route("**/api/letterboxd-watchlist", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture),
      }),
    );

    await page.goto("/");
    await waitForGeoReady(page);

    await page.getByTestId("tab-list").click();
    await page.getByTestId("list-url").fill("https://letterboxd.com/user/watchlist/");
    await page.getByTestId("list-submit").click();

    // Wait for all tiles to render
    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(TILE_COUNT, {
      timeout: 30_000,
    });

    // Wait for provider icons to appear
    await expect(page.getByTestId("provider-icons").locator("button").first()).toBeVisible({
      timeout: 15_000,
    });

    // Clear any baseline profiler data
    await page.evaluate(() => (window as Record<string, unknown>).__PERF_DATA__?.clearPerfData?.());

    const providerNames: string[] = [];
    // Collect up to 5 provider names from the filter bar
    for (let i = 0; i < 5; i++) {
      const button = page.getByTestId("provider-icons").locator("button").nth(i);
      const name = await button.getAttribute("data-sp");
      if (name) providerNames.push(name);
    }

    // Toggle each filter on then off, measuring latency
    for (const name of providerNames) {
      // Toggle ON
      const onStart = `toggle-on-start-${name}`;
      const onEnd = `toggle-on-end-${name}`;
      await page.evaluate((s) => performance.mark(s), onStart);
      await page.getByTestId("provider-icons").locator(`button[data-sp="${name}"]`).click();
      await page.evaluate((s) => performance.mark(s), onEnd);
      await page.evaluate(({ start, end, label }) => performance.measure(label, start, end), {
        start: onStart,
        end: onEnd,
        label: `toggle-on-${name}`,
      });

      // Small pause for React to settle
      await page.waitForTimeout(200);

      // Toggle OFF
      const offStart = `toggle-off-start-${name}`;
      const offEnd = `toggle-off-end-${name}`;
      await page.evaluate((s) => performance.mark(s), offStart);
      await page.getByTestId("provider-icons").locator(`button[data-sp="${name}"]`).click();
      await page.evaluate((s) => performance.mark(s), offEnd);
      await page.evaluate(({ start, end, label }) => performance.measure(label, start, end), {
        start: offStart,
        end: offEnd,
        label: `toggle-off-${name}`,
      });

      await page.waitForTimeout(100);
    }

    // Collect measurements
    const measurements: { label: string; duration: number }[] = [];
    for (const name of providerNames) {
      for (const dir of ["on", "off"]) {
        const label = `toggle-${dir}-${name}`;
        const duration = await page.evaluate((lbl: string) => {
          const entries = performance.getEntriesByName(lbl);
          return entries.length > 0 ? entries[entries.length - 1].duration : -1;
        }, label);
        measurements.push({ label, duration });
      }
    }

    // Assert each toggle is under 200ms (generous budget for CI)
    for (const m of measurements) {
      expect(m.duration, `${m.label}`).toBeLessThan(200);
    }

    // Collect profiler data if available
    const profilerEntries = await page.evaluate(() => {
      const pd = (window as Record<string, unknown>).__PERF_DATA__ as
        | { getPerfData?: () => { id: string; actualDuration: number }[] }
        | undefined;
      return pd?.getPerfData?.() ?? null;
    });

    if (profilerEntries) {
      const tileGridEntries = profilerEntries.filter((e) => e.id === "TileGrid");
      if (tileGridEntries.length > 0) {
        const avgMs =
          tileGridEntries.reduce((sum, e) => sum + e.actualDuration, 0) / tileGridEntries.length;
        // Tile grid render should average under 100ms for 200 tiles
        expect(avgMs).toBeLessThan(100);
      }
    }
  });
});
