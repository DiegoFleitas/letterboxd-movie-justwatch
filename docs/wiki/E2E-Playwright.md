# E2E (Playwright)

Playwright config: [`playwright.config.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/playwright.config.ts). Tests live in [`tests/e2e/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests/e2e).

## Two kinds of tests

| Files                                                                                                                         | What they validate                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **`app-shell`**, **`movie-form`**, **`list-form`**, **`filtering`**, **`alternative-search`** (`.spec.ts` under `tests/e2e/`) | UI flows with **`page.route()`** mocking `/api/*`. Requests do not hit Fastify. Shared: `app-test-helpers.ts`.                      |
| **`backend-smoke.spec.ts`**                                                                                                   | Real HTTP to Fastify: `/healthcheck`, `/redis-healthcheck`. CI runs `bun run build`, starts `bun run dev`, then `bun run test:e2e`. |

## API URL for smoke tests

- Default: **`http://127.0.0.1:3000`** (same default `PORT` as [`src/server/main.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/src/server/main.ts)).
- Override: **`E2E_API_BASE_URL`** (no trailing slash), e.g. `http://127.0.0.1:3001`.

`webServer` in Playwright only waits on **5173** (Vite). The backend must already be listening on the smoke base URL—locally run **`bun run dev`** (frontend + backend) before **`bun run test:e2e`**.

## Reports and artifacts

| Output                                   | Path                      |
| ---------------------------------------- | ------------------------- |
| HTML report                              | `tests/playwright-report` |
| Traces, failure screenshots, attachments | `tests/test-results`      |

## Related

- [Commands](Commands) — `bun run test:e2e`
- [Tests](Tests) — Vitest vs Playwright layout

**In-repo copy:** [`tests/e2e/README.md`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/tests/e2e/README.md).
