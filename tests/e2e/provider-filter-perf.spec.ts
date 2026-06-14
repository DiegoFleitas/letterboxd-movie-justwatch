import { test, expect } from "@playwright/test";
import {
  letterboxdFixtures,
  mockGeoIpRoute,
  type SearchMovieBody,
  waitForGeoReady,
} from "./app-test-helpers.js";

// Two canonical providers, assigned to tiles by index parity so that toggling a
// filter actually shrinks the visible set (and clearing it expands back to the
// full list — the path this spec guards).
const PERF_PROVIDERS = [
  {
    id: "disneyplus",
    name: "Disney Plus",
    icon: "https://images.justwatch.com/icon/313118777/s100/disneyplus.jpg",
    url: "https://example.com/disney",
    type: "FLATRATE",
  },
  {
    id: "netflix",
    name: "Netflix",
    icon: "https://images.justwatch.com/icon/207360008/s100/netflix.jpg",
    url: "https://example.com/netflix",
    type: "FLATRATE",
  },
];

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
        body: JSON.stringify(fixture[0].response),
      }),
    );

    // Enrich every tile with a provider so the filter bar is populated. Assign
    // by the `#N` suffix parity baked into each title by expandFixture.
    await page.route("**/api/search-movie", (route) => {
      const body = route.request().postDataJSON() as SearchMovieBody | null;
      const title = body?.title ?? "";
      const match = /#(\d+)$/.exec(title);
      const idx = match ? Number(match[1]) : 0;
      const provider = PERF_PROVIDERS[idx % PERF_PROVIDERS.length];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Movie found",
          movieProviders: [provider],
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

    // Wait for all tiles to render
    await expect(page.getByTestId("poster-showcase").getByTestId("tile")).toHaveCount(TILE_COUNT, {
      timeout: 30_000,
    });

    // Wait for provider icons to appear
    await expect(page.getByTestId("provider-icons").locator("button").first()).toBeVisible({
      timeout: 15_000,
    });

    // Clear any baseline profiler data
    await page.evaluate(() =>
      (
        window as unknown as { __PERF_DATA__?: { clearPerfData?: () => void } }
      ).__PERF_DATA__?.clearPerfData?.(),
    );

    const providerNames: string[] = [];
    // Collect up to 5 provider names from the filter bar (excluding the
    // alternative-search toggle), tolerant of however many are present.
    const filterButtons = page.getByTestId("provider-icons").locator("button[data-sp]");
    const buttonCount = await filterButtons.count();
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const name = await filterButtons.nth(i).getAttribute("data-sp");
      if (name && name !== "alternative search") providerNames.push(name);
    }
    expect(providerNames.length).toBeGreaterThan(0);

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

    // Loose sanity ceiling only. This wall-clock window brackets Playwright's
    // click() (actionability + scroll + IPC over a 200-tile DOM), so it is
    // dominated by harness overhead rather than React render cost — it cannot
    // reliably detect a render regression. The Profiler assertion below is the
    // real gate; this just catches a hard hang.
    for (const m of measurements) {
      expect(m.duration, `${m.label}`).toBeLessThan(1000);
    }

    // The React Profiler `actualDuration` is the meaningful signal: it measures
    // the time React spent rendering the TileGrid on each commit. This is a
    // hard gate — if the profiler bridge is missing the test fails rather than
    // silently passing.
    const profilerEntries = await page.evaluate(() => {
      const w = window as unknown as {
        __PERF_DATA__?: { getPerfData?: () => { id: string; actualDuration: number }[] };
      };
      const pd = w.__PERF_DATA__;
      return pd?.getPerfData?.() ?? null;
    });

    expect(profilerEntries, "profiler bridge should be present").not.toBeNull();
    const tileGridEntries = (profilerEntries ?? []).filter((e) => e.id === "TileGrid");
    expect(tileGridEntries.length, "expected TileGrid profiler commits").toBeGreaterThan(0);

    const avgMs =
      tileGridEntries.reduce((sum, e) => sum + e.actualDuration, 0) / tileGridEntries.length;

    console.log(
      `[perf] toggle TileGrid commits=${tileGridEntries.length} avg=${avgMs.toFixed(1)}ms`,
    );
    // Coarse ceiling: average tile-grid render across all toggles stays bounded.
    expect(avgMs).toBeLessThan(100);

    // Hover diagnostic. Hovering a provider icon only flips `focusedProvider`
    // state in RightPanel; the visible tiles are unchanged. React.memo on
    // MovieTile skips each tile body on these spurious re-renders (~30-40% less
    // render at 200 tiles, far more at the 700+ list sizes that motivated this
    // work). The absolute number is too noisy at this tile count to gate
    // tightly, so we log it and keep only a generous ceiling that catches a
    // catastrophic regression (e.g. a hover that triggers a full remount).
    await page.evaluate(() =>
      (
        window as unknown as { __PERF_DATA__?: { clearPerfData?: () => void } }
      ).__PERF_DATA__?.clearPerfData?.(),
    );
    const hoverTarget = providerNames[0];
    for (let h = 0; h < 5; h++) {
      await page.getByTestId("provider-icons").locator(`button[data-sp="${hoverTarget}"]`).hover();
      await page.mouse.move(0, 0);
    }
    await page.waitForTimeout(100);

    const hoverEntries = await page.evaluate(() => {
      const w = window as unknown as {
        __PERF_DATA__?: { getPerfData?: () => { id: string; actualDuration: number }[] };
      };
      return (w.__PERF_DATA__?.getPerfData?.() ?? []).filter((e) => e.id === "TileGrid");
    });
    const hoverTotalMs = hoverEntries.reduce((sum, e) => sum + e.actualDuration, 0);

    console.log(
      `[perf] hover TileGrid commits=${hoverEntries.length} total=${hoverTotalMs.toFixed(1)}ms`,
    );
    expect(hoverTotalMs, "hovering must not trigger a catastrophic re-render").toBeLessThan(800);
  });
});
