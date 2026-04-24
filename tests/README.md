# Tests

Unit and integration tests use **[Vitest](https://vitest.dev/)**. End-to-end tests use **Playwright** (`tests/e2e/`).

## Commands

| Command                                                                          | What it runs                                                                                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `bun run test` / `bun run test:unit`                                             | All Vitest tests under `tests/**/*.test.ts` (see exclusions in `vitest.config.ts`)                                            |
| `bun run test:backend`                                                           | Fastify integration tests only                                                                                                |
| `bun run test:filter`, `test:state`, `test:posthog`, `test:redis`, `test:dedupe` | Single Vitest files                                                                                                           |
| `bun run test:e2e`                                                               | Playwright (`tests/e2e/*.spec.ts`; UI mocks + `backend-smoke.spec.ts`)                                                        |
| `bun run test:poster-flow`                                                       | Manual script: hits `localhost:3000` (backend must be running); **not** part of `bun run test`                                |
| `bun run knip`                                                                   | Unused deps / files / exports (not Vitest); see root [`README.md`](../README.md#contributing) and [`knip.json`](../knip.json) |

Config: root [`vitest.config.ts`](../vitest.config.ts) (Node environment, `APP_SECRET_KEY` for sessions). Poster-flow is excluded from the default Vitest run because it requires a live server.

**Path aliases** (see root [`tsconfig.json`](../tsconfig.json) and Vitest `resolve.alias`): `@server/…` → `src/server/…`, `@/…` → `src/client/src/…`. Prefer these over long `../src/...` chains in new tests.

## Layout

- **`tests/*.test.ts`** – unit/integration tests (`describe` / `it` / `expect`).
- **`tests/backend.integration.test.ts`** – Fastify HTTP checks; optional `MOVIE_DB_API_KEY` enables the search-movie case.
- **`tests/fixtures/`** – HTML/JSON fixtures for scrapers and state tests.
- **`tests/e2e/*.spec.ts`** (except `backend-smoke`) – browser E2E with mocked `/api/*`; see `tests/e2e/README.md`.

## Cross-layer imports from client src

A few Vitest files **import modules from the Vite app** on purpose so logic stays single-sourced:

| Test file                       | Imports (see `@/` alias)                |
| ------------------------------- | --------------------------------------- |
| `stateTileManagement.test.ts`   | `@/movieTiles` (tab/tile state helpers) |
| `providerDeduplication.test.ts` | `@/providerUtils`                       |

If you rename or move those modules, run **`bun run test`** and the **frontend** test suite (`src/client/src/__tests__/`) together—they exercise the same code from different runners.

The browser bundle only imports **`@server/lib/letterboxdListUrl`** (via `useLetterboxdList.ts`) today; avoid adding more cross-layer imports from the client app without a dedicated small helper module so coupling and bundle size stay predictable.

## Adding tests

1. Add `tests/yourFeature.test.ts` (or match existing naming).
2. Use Vitest:

```ts
import { describe, it, expect } from "vitest";

describe("your feature", () => {
  it("does something", () => {
    expect(1 + 1).toBe(2);
  });
});
```

3. Optional: add a script in `package.json`, e.g. `"test:yourfeature": "bunx vitest run tests/yourFeature.test.ts"`.
