# Provider Filter Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile and optimize the provider filter toggle in the RightPanel — fix the Set-in-loop CPU bottleneck, add React Profiler instrumentation, and create a Playwright regression test.

**Architecture:** Three workstreams: (1) refactor `providerUtils.ts` to hoist Set construction once before the per-tile filter loop, (2) add a lightweight profiler wrapper exposed on `window.__PERF_DATA__`, (3) a Playwright e2e spec that loads a 200+ tile fixture and measures toggle latency.

**Tech Stack:** React 19, TypeScript, Playwright, Vitest, Framer Motion

**Spec:** `docs/superpowers/specs/2026-06-13-provider-filter-perf-design.md`

---

## File Structure

| File                                             | Action     | Purpose                                                                                             |
| ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| `src/client/src/utils/providerUtils.ts`          | Edit       | Add `createProviderFilterSet()`, change `tileMatchesProviderFilter` to accept `Set<string> \| null` |
| `src/client/src/components/RightPanel.tsx`       | Edit       | Hoist Set construction in `visibleTiles` useMemo; add `<Profiler>` wrappers                         |
| `src/client/src/utils/componentProfiler.ts`      | **Create** | React Profiler wrapper with `window.__PERF_DATA__` bridge                                           |
| `tests/providerDeduplication.test.ts`            | Edit       | Update `tileMatchesProviderFilter` call sites to use `Set<string> \| null`                          |
| `src/client/src/__tests__/providerUtils.test.ts` | Edit       | Update `tileMatchesProviderFilter` call sites to use `Set<string> \| null`                          |
| `tests/e2e/provider-filter-perf.spec.ts`         | **Create** | Performance regression test with 200+ tile fixture                                                  |

---

## Task segments

### Task 1: Refactor providerUtils.ts

**Files:**

- Modify: `src/client/src/utils/providerUtils.ts`

**Step 1.1: Update `providerUtils.ts`**

Add `createProviderFilterSet` and change `tileMatchesProviderFilter` signature to accept a pre-computed `Set<string> | null` instead of `string[]`:

```typescript
/**
 * Provider normalization and filter matching using gathered canonical data when available.
 */
type CanonicalByNames = Record<string, { id: string; name: string }>;

function getCanonicalByNames(): CanonicalByNames | null | undefined {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __CANONICAL_PROVIDERS_BY_NAME__?: CanonicalByNames };
  return w.__CANONICAL_PROVIDERS_BY_NAME__;
}

export function normalizedProviderKey(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  const byName = getCanonicalByNames();
  if (byName?.[name]) return byName[name].id;
  return name;
}

export interface ProviderLike {
  id: string;
  name: string;
  icon?: string;
}

export function createProviderFilterSet(activeFilterNames: string[]): Set<string> | null {
  if (!Array.isArray(activeFilterNames) || activeFilterNames.length === 0) return null;
  const byName = getCanonicalByNames();
  if (byName && Object.keys(byName).length > 0) {
    return new Set(activeFilterNames.map((n) => normalizedProviderKey(n)));
  }
  return new Set(activeFilterNames);
}

export function deduplicateProviderList(providers: ProviderLike[]): ProviderLike[] {
  const all = Array.isArray(providers) ? providers.filter((p) => p?.name) : [];
  const byName = getCanonicalByNames();
  if (!byName || !Object.keys(byName).length) return all;
  const byCanonicalId = new Map<string, ProviderLike>();
  for (const p of all) {
    const canonical = byName[p.name];
    const id = canonical ? canonical.id : p.id;
    if (!byCanonicalId.has(id) || (canonical && canonical.name === p.name))
      byCanonicalId.set(id, p);
  }
  return Array.from(byCanonicalId.values());
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

- [ ] **Step 1.1: Apply the edit to `providerUtils.ts`**
- [ ] **Step 1.2: Verify it compiles**

Run: `bun run typecheck`

---

### Task 2: Update existing unit tests

**Files:**

- Modify: `tests/providerDeduplication.test.ts`
- Modify: `src/client/src/__tests__/providerUtils.test.ts`

Both import `tileMatchesProviderFilter` and pass `string[]` as the second argument. Change all call sites to pass a pre-computed `Set<string> | null`.

**Step 2.1: Update `tests/providerDeduplication.test.ts`**

Add `createProviderFilterSet` to the import:

```typescript
import {
  createProviderFilterSet,
  tileMatchesProviderFilter,
  normalizedProviderKey,
  deduplicateProviderList,
} from "@/utils/providerUtils.js";
```

Change call sites:

| Before                                                                | After                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `tileMatchesProviderFilter(["HBO Max"], ["HBO Max"])`                 | `tileMatchesProviderFilter(["HBO Max"], new Set(["HBO Max"]))`                 |
| `tileMatchesProviderFilter(["HBO Max  Amazon Channel"], ["HBO Max"])` | `tileMatchesProviderFilter(["HBO Max  Amazon Channel"], new Set(["HBO Max"]))` |
| `tileMatchesProviderFilter(["Netflix"], [])`                          | `tileMatchesProviderFilter(["Netflix"], null)`                                 |
| `tileMatchesProviderFilter([], ["Netflix"])`                          | `tileMatchesProviderFilter([], new Set(["Netflix"]))`                          |
| canonical: `tileMatchesProviderFilter(...)`                           | `tileMatchesProviderFilter(..., new Set(["HBO Max"]))`                         |
| canonical: `tileMatchesProviderFilter(...)`                           | `tileMatchesProviderFilter(..., new Set(["HBO Max  Amazon Channel"]))`         |

Add a test for `createProviderFilterSet` inside the same `describe` block:

```typescript
it("createProviderFilterSet returns canonical IDs when map is set", () => {
  const map = {
    "HBO Max": { id: "max", name: "HBO Max" },
    "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
  };
  const prev = (globalThis as { window?: unknown }).window;
  (
    globalThis as {
      window?: { __CANONICAL_PROVIDERS_BY_NAME__?: Record<string, { id: string; name: string }> };
    }
  ).window = { __CANONICAL_PROVIDERS_BY_NAME__: map };
  try {
    expect(createProviderFilterSet(["HBO Max", "HBO Max  Amazon Channel"])).toEqual(
      new Set(["max"]),
    );
    expect(createProviderFilterSet(["Netflix"])).toEqual(new Set(["Netflix"]));
    expect(createProviderFilterSet([])).toBeNull();
  } finally {
    (globalThis as { window?: unknown }).window = prev;
  }
});
```

**Step 2.2: Update `src/client/src/__tests__/providerUtils.test.ts`**

Add `createProviderFilterSet` to the import:

```typescript
import {
  createProviderFilterSet,
  deduplicateProviderList,
  normalizedProviderKey,
  tileMatchesProviderFilter,
  type ProviderLike,
} from "../utils/providerUtils";
```

Change call sites:

| Before                                                                     | After                                                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tileMatchesProviderFilter(["HBO Max"], ["HBO Max"])`                      | `tileMatchesProviderFilter(["HBO Max"], new Set(["HBO Max"]))`                      |
| `tileMatchesProviderFilter(["HBO Max  Amazon Channel"], ["HBO Max"])`      | `tileMatchesProviderFilter(["HBO Max  Amazon Channel"], new Set(["HBO Max"]))`      |
| canonical: `tileMatchesProviderFilter(...)`                                | `tileMatchesProviderFilter(..., new Set(["HBO Max"]))`                              |
| canonical: `tileMatchesProviderFilter(...)`                                | `tileMatchesProviderFilter(..., new Set(["HBO Max  Amazon Channel"]))`              |
| `tileMatchesProviderFilter(["Netflix"], [])`                               | `tileMatchesProviderFilter(["Netflix"], null)`                                      |
| `tileMatchesProviderFilter(["Netflix"], undefined as unknown as string[])` | `tileMatchesProviderFilter(["Netflix"], null)`                                      |
| `tileMatchesProviderFilter([], ["Netflix"])`                               | `tileMatchesProviderFilter([], new Set(["Netflix"]))`                               |
| `tileMatchesProviderFilter(undefined as unknown as string[], ["Netflix"])` | `tileMatchesProviderFilter(undefined as unknown as string[], new Set(["Netflix"]))` |

Add a test for `createProviderFilterSet`:

```typescript
describe("createProviderFilterSet", () => {
  it("returns null for empty or invalid inputs", () => {
    setCanonicalMap();
    expect(createProviderFilterSet([])).toBeNull();
    expect(createProviderFilterSet(undefined as unknown as string[])).toBeNull();
  });

  it("returns a Set of provider keys when canonical map is unavailable", () => {
    setCanonicalMap();
    const result = createProviderFilterSet(["HBO Max", "Netflix"]);
    expect(result).toEqual(new Set(["HBO Max", "Netflix"]));
  });

  it("returns a Set of canonical IDs when canonical map is available", () => {
    setCanonicalMap({
      "HBO Max": { id: "max", name: "HBO Max" },
      "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
    });
    const result = createProviderFilterSet(["HBO Max", "HBO Max  Amazon Channel", "Netflix"]);
    expect(result).toEqual(new Set(["max", "Netflix"]));
  });
});
```

- [ ] **Step 2.1: Update `tests/providerDeduplication.test.ts`**
- [ ] **Step 2.2: Update `src/client/src/__tests__/providerUtils.test.ts`**
- [ ] **Step 2.3: Run both test files to verify they pass**

Run:

```bash
bunx vitest run tests/providerDeduplication.test.ts
bunx vitest run src/client/src/__tests__/providerUtils.test.ts
```

---

### Task 3: Create componentProfiler.ts

**Files:**

- Create: `src/client/src/utils/componentProfiler.ts`

**Step 3.1: Write the profiler module**

```typescript
import { type ProfilerOnRenderCallback } from "react";

export interface PerfEntry {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  timestamp: number;
}

const entries: PerfEntry[] = [];
const MAX_ENTRIES = 10_000;

const isEnabled =
  typeof window !== "undefined" && (import.meta.env.DEV || import.meta.env.VITE_PROFILER === "1");

export const recordProfile: ProfilerOnRenderCallback = (
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
): void => {
  if (!isEnabled) return;
  const entry: PerfEntry = { id, phase, actualDuration, timestamp: performance.now() };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  if (import.meta.env.DEV) {
    console.debug(`[Perf] ${id} (${phase}): ${actualDuration.toFixed(2)}ms`);
  }
};

export function getPerfData(): PerfEntry[] {
  return entries;
}

export function clearPerfData(): void {
  entries.length = 0;
}

// Bridge for Playwright to read profiler data via page.evaluate()
if (typeof window !== "undefined") {
  (window as Record<string, unknown>).__PERF_DATA__ = {
    getPerfData,
    clearPerfData,
  };
}
```

- [ ] **Step 3.1: Create `componentProfiler.ts`**

---

### Task 4: Update RightPanel.tsx — hoist Set construction + add Profiler

**Files:**

- Modify: `src/client/src/components/RightPanel.tsx`

**Step 4.1: Add imports**

Add to the existing import block:

```typescript
import { Profiler } from "react";
import { createProviderFilterSet, tileMatchesProviderFilter } from "../utils/providerUtils";
import { recordProfile } from "../utils/componentProfiler";
```

Note: `tileMatchesProviderFilter` and `ProviderLike` are already imported from `../utils/providerUtils` — just add `createProviderFilterSet` to that existing destructure. `Profiler` and `recordProfile` are the new additions.

**Step 4.2: Hoist Set construction in `visibleTiles`**

Replace the `visibleTiles` useMemo (currently lines 79-87) with:

```typescript
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

**Step 4.3: Wrap tile grid with Profiler**

Wrap the tile rendering section (currently lines 178-199) with `<Profiler>`:

```typescript
<Profiler id="TileGrid" onRender={recordProfile}>
  {suppressAnimations ? (
    visibleTiles.map((tile, idx) => (
      <MovieTile
        key={tile.id}
        data={tile}
        index={idx}
        onAlternativeSearch={handleAlternativeSearch}
        suppressAnimations
      />
    ))
  ) : (
    <AnimatePresence mode="popLayout">
      {visibleTiles.map((tile, idx) => (
        <MovieTile
          key={tile.id}
          data={tile}
          index={idx}
          onAlternativeSearch={handleAlternativeSearch}
        />
      ))}
    </AnimatePresence>
  )}
</Profiler>
```

- [ ] **Step 4.1: Update imports in RightPanel.tsx**
- [ ] **Step 4.2: Apply the visibleTiles optimization**
- [ ] **Step 4.3: Wrap tile grid in `<Profiler>`**
- [ ] **Step 4.4: Run typecheck to verify**

Run: `bun run typecheck` — should pass

---

### Task 5: Create Playwright performance test

**Files:**

- Create: `tests/e2e/provider-filter-perf.spec.ts`

**Step 5.1: Write the spec**

```typescript
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
```

- [ ] **Step 5.1: Create `tests/e2e/provider-filter-perf.spec.ts`**

---

### Task 6: Verify the full pipeline

- [ ] **Step 6.1: Run typecheck**

```bash
bun run typecheck
```

Expected: No type errors

- [ ] **Step 6.2: Run client unit tests**

```bash
bunx vitest run src/client/src/__tests__/providerUtils.test.ts
```

Expected: All pass

- [ ] **Step 6.3: Run provider deduplication tests**

```bash
bunx vitest run tests/providerDeduplication.test.ts
```

Expected: All pass

- [ ] **Step 6.4: Run existing Playwright test**

```bash
bunx playwright test tests/e2e/filtering.spec.ts
```

Expected: Existing e2e test still passes

- [ ] **Step 6.5: Run lint**

```bash
bun run lint
```

Expected: No lint errors
