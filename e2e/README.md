# E2E tests (Playwright)

Regression tests for the app. Run them **before** the React migration; after migrating, run the same suite to verify behavior.

## Run locally

**Option A – use existing dev server (recommended)**

```bash
pnpm run dev   # in one terminal
pnpm run test:e2e   # in another
```

If something is already serving `http://localhost:5173`, Playwright will reuse it (see `reuseExistingServer` in `playwright.config.js`).

**Option B – let Playwright start the app**

```bash
pnpm run test:e2e
```

Playwright will run `pnpm run dev` and wait for the app to be ready (longer first run).

## Run in CI

Set `CI=true` so Playwright starts the server and does not reuse an existing one.

## Scenarios

- **App shell:** Left panel (country, tabs, movie/list forms), right panel (poster showcase, provider icons).
- **Movie form:** Submit title/year → POST `/api/search-movie` → toast.
- **List form:** Submit Letterboxd URL → POST watchlist → tiles appear in poster showcase (mocked APIs).
- **Filtering:** Load list, click provider icon → tiles filter by provider.
- **Alternative search:** Movie search then “Torrent search” → POST `/api/alternative-search` → toast (mocked).

API responses are mocked in tests so they don’t depend on real JustWatch/Letterboxd.

## Artifacts on failure

When a test fails, Playwright saves screenshots in `test-results/` (e.g. `test-results/.../test-failed-1.png`), plus traces (open with `npx playwright show-trace test-results/.../trace.zip`) and the HTML report (`npx playwright show-report`). Configured in `playwright.config.js`: `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`.
