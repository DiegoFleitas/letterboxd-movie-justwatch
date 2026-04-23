# E2E (Playwright)

## Two kinds of tests

| Files                                                                                                                                 | What they validate                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **`app-shell.spec.ts`**, **`movie-form.spec.ts`**, **`list-form.spec.ts`**, **`filtering.spec.ts`**, **`alternative-search.spec.ts`** | UI flows with **`page.route()`** mocking `/api/*`. Requests never reach Fastify. Shared helpers: `app-test-helpers.ts`.                        |
| **`backend-smoke.spec.ts`**                                                                                                           | Real HTTP calls to the **Fastify** process (`/healthcheck`, `/redis-healthcheck`). Proves the API is up (CI runs `bun run dev` + build first). |

## API URL for smoke tests

- Default: **`http://127.0.0.1:3000`** (same as `PORT` default in `src/server/main.ts`).
- Override: set **`E2E_API_BASE_URL`** (no trailing slash), e.g. `http://127.0.0.1:3001`.

Playwright’s `webServer` only waits on **5173** (Vite). The backend must be listening on the smoke base URL—locally run `bun run dev` (fe + be) before `bun run test:e2e`.

## Reports and artifacts

The HTML report is written to **`tests/playwright-report`**, and traces, screenshots, and other run output go to **`tests/test-results`** (see root `playwright.config.ts`).
