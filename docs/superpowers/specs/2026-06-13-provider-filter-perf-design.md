# Provider Filter Performance: Testing & Profiling

## Problem

In production with 200+ movie tiles, toggling provider filter buttons causes UI stutter. The filter logic rebuilds data structures unnecessarily inside per-tile loops, and there is no instrumentation to measure or guard against regressions.

## Solution Overview

Combine three workstreams:

1. **Fix the obvious CPU bottleneck** — hoist filter Set construction out of the per-tile loop
2. **React Profiler instrumentation** — lightweight wrapper to measure render durations, exposed for Playwright consumption
3. **Playwright performance regression test** — large-fixture E2E spec that measures toggle latency and asserts budgets

---

## 1. Bottleneck Fix

### Current problem

`tileMatchesProviderFilter` in `providerUtils.ts` builds a `new Set(activeFilterNames.map(...))` on every invocation. It is called once per tile inside `visibleTiles` `.filter()` — for 200 tiles that is 200 identical Set allocations.

### Change: `providerUtils.ts`

Rename `tileMatchesProviderFilter` to accept a pre-computed `Set<string>` as the filter argument instead of `string[]`. Add `createProviderFilterSet(activeFilterNames: string[]): Set<string> | null` that builds the set once.

```ts
export function createProviderFilterSet(activeFilterNames: string[]): Set<string> | null {
  if (!Array.isArray(activeFilterNames) || activeFilterNames.length === 0) return null;
  const byName = getCanonicalByNames();
  if (byName && Object.keys(byName).length > 0) {
    return new Set(activeFilterNames.map((n) => normalizedProviderKey(n)));
  }
  return new Set(activeFilterNames);
}

export function tileMatchesProviderFilter(
  tileProviderNames: string[],
  activeFilterSet: Set<string> | null,
): boolean {
  if (activeFilterSet == null) return true;
  const names = Array.isArray(tileProviderNames) ? tileProviderNames : [];
  if (names.length === 0) return false;
  return names.some((n) => activeFilterSet.has(n));
}
```

### Change: `RightPanel.tsx`

Call `createProviderFilterSet` once before the `.filter()` loop:

```ts
const visibleTiles = useMemo((): TileData[] => {
  const filterSet = createProviderFilterSet(activeFilters);
  return tileList.filter((tile: TileData) => {
    const names = getTileProviderNames(tile);
    if (altSearchFilter) return names.length > 0;
    if (!filterSet) return true;
    if (!names.length) return false;
    return tileMatchesProviderFilter(names, filterSet);
  });
}, [tileList, activeFilters, altSearchFilter]);
```

---

## 2. React Profiler Instrumentation

### New file: `src/client/src/utils/componentProfiler.ts`

Thin wrapper around React `<Profiler>` that:

- Logs render durations in development (`import.meta.env.DEV`)
- Accumulates data on `window.__PERF_DATA__` for Playwright to read via `page.evaluate()`
- Supports multiple named profiler instances (e.g. `"TileGrid"`, `"FilterBar"`)
- No-op when `VITE_PROFILER` is not set (tree-shaken by Vite in production)

```ts
import { Profiler, type ProfilerOnRenderCallback } from "react";

interface PerfEntry {
  id: string;
  phase: string;
  actualDuration: number;
  timestamp: number;
}

const entries: PerfEntry[] = [];
const isEnabled = typeof window !== "undefined" && import.meta.env.DEV;

export function recordProfile(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
): void {
  if (!isEnabled) return;
  const entry: PerfEntry = { id, phase, actualDuration, timestamp: performance.now() };
  entries.push(entry);
  // Limit in-memory storage to prevent OOM during long sessions
  if (entries.length > 10_000) entries.splice(0, entries.length - 10_000);
  console.debug(`[Perf] ${id} (${phase}): ${actualDuration.toFixed(2)}ms`);
}

export function getPerfData(): PerfEntry[] {
  return entries;
}

export function clearPerfData(): void {
  entries.length = 0;
}

// Playwright hook
if (typeof window !== "undefined") {
  (window as Record<string, unknown>).__PERF_DATA__ = {
    getPerfData,
    clearPerfData,
    recordProfile,
  };
}
```

### Wrapping in `RightPanel.tsx`

Wrap two areas with `<Profiler>`:

1. The provider button bar (`#icons-container-main`) — identifies if filter button re-renders are costly
2. The tile grid (`div.poster-showcase` + `AnimatePresence`) — captures full tile reconciliation cost

### Production tree-shaking

Vite strips `import.meta.env.DEV` branches in production builds. For production profiling, gate behind `VITE_PROFILER` env var:

```ts
const isEnabled =
  typeof window !== "undefined" && (import.meta.env.DEV || import.meta.env.VITE_PROFILER === "1");
```

---

## 3. Playwright Performance Regression Test

### New file: `tests/e2e/provider-filter-perf.spec.ts`

### Fixture

Current fixture has 18 movies. For 200+ tile reproduction we need a larger dataset.

**Approach: synthetic expansion** — a helper function in the spec file takes the existing fixture and replicates its entries N times, generating unique IDs and titles by appending a counter. This is deterministic, fast, and avoids network dependencies.

```ts
function expandFixture(base: typeof letterboxdFixtures, tileCount: number) {
  const baseList = base[0].response.watchlist;
  const expanded = [];
  for (let i = 0; i < tileCount; i++) {
    const entry = { ...baseList[i % baseList.length] };
    entry.title = `${entry.title} #${i}`;
    entry.year = String(Number(entry.year ?? 2024) + Math.floor(i / baseList.length));
    expanded.push(entry);
  }
  return [{ ...base[0], response: { ...base[0].response, watchlist: expanded } }];
}
```

### Test flow

```ts
test("filter toggle latency stays under budget with 200+ tiles", async ({ page }) => {
  // 1. Route API interception with expanded fixture
  await page.route("**/api/letterboxd-watchlist", ...expandFixture(200));

  // 2. Navigate and wait for all tiles to render
  await page.goto("/");
  // ... fill list URL, submit, wait for tiles

  // 3. Clear profiler data
  await page.evaluate(() => window.__PERF_DATA__?.clearPerfData?.());

  // 4. Toggle a filter — measure JS + React render time
  const toggleResults = [];
  for (const providerName of ["Disney Plus", "Netflix", "Prime Video"]) {
    const markStart = `toggle-start-${providerName}`;
    const markEnd = `toggle-end-${providerName}`;
    await page.evaluate((name) => performance.mark(markStart), markStart);
    await page.getByTestId("provider-icons").locator(`button[data-sp="${providerName}"]`).click();
    await page.evaluate((name) => performance.mark(markEnd), markEnd);
    await page.evaluate(({ s, e, label }) => performance.measure(label, s, e), {
      s: markStart,
      e: markEnd,
      label: `toggle-${providerName}`,
    });

    const measure = await page.evaluate((label) => {
      const entries = performance.getEntriesByName(label);
      return entries.length > 0 ? entries[entries.length - 1].duration : -1;
    }, `toggle-${providerName}`);

    const perfData = await page.evaluate(() => window.__PERF_DATA__?.getPerfData?.());

    toggleResults.push({ providerName, jsDuration: measure, profilerData: perfData });
  }

  // 5. Assertions
  for (const r of toggleResults) {
    expect(r.jsDuration).toBeLessThan(100);
  }
  // Verify React profiler shows reasonable per-tile render time
  const tileRenderEntries = toggleResults
    .flatMap((r) => r.profilerData ?? [])
    .filter((e) => e.id === "TileGrid");
  const avgTileRender =
    tileRenderEntries.reduce((a, b) => a + b.actualDuration, 0) / tileRenderEntries.length;
  expect(avgTileRender).toBeLessThan(50); // 50ms average for 200 tiles = 0.25ms per tile
});
```

### CDP Tracing (optional bonus)

For deeper investigation, Playwright can record a Chrome DevTools Protocol performance trace:

```ts
await page.context().tracing.start({ screenshots: false, snapshots: false });
// ... run toggles ...
await page.context().tracing.stop({ path: "trace/provider-filter-trace.zip" });
```

This is useful for ad-hoc debugging but too heavy for regular CI. Keep as a `--headed` flag option.

---

## Files changed / created

| File                                        | Action     | Description                                                                 |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `src/client/src/utils/providerUtils.ts`     | Edit       | Extract `createProviderFilterSet`, simplify `tileMatchesProviderFilter`     |
| `src/client/src/components/RightPanel.tsx`  | Edit       | Hoist Set construction in `visibleTiles` useMemo; add `<Profiler>` wrappers |
| `src/client/src/utils/componentProfiler.ts` | **Create** | Profiler wrapper with Playwright data bridge                                |
| `tests/e2e/provider-filter-perf.spec.ts`    | **Create** | Performance regression test with 200+ tile fixture                          |

---

## Out of scope

- Backend perf (not relevant to UI stutter on toggle)
- Animation tuning (framer-motion config — investigate only if CDP trace shows frame drops)
- Network request batching (posters, search — separate concern)
