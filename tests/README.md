# Tests

Unit and integration tests use **[Vitest](https://vitest.dev/)**. End-to-end tests use **Playwright** (`e2e/`).

## Commands

| Command                                                                          | What it runs                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bun run test` / `bun run test:unit`                                             | All Vitest tests under `tests/**/*.test.ts` (see exclusions in `vitest.config.ts`)             |
| `bun run test:backend`                                                           | Fastify integration tests only                                                                 |
| `bun run test:filter`, `test:state`, `test:posthog`, `test:redis`, `test:dedupe` | Single Vitest files                                                                            |
| `bun run test:e2e`                                                               | Playwright (`e2e/app.spec.ts`)                                                                 |
| `bun run test:poster-flow`                                                       | Manual script: hits `localhost:3000` (backend must be running); **not** part of `bun run test` |

Config: root [`vitest.config.ts`](../vitest.config.ts) (Node environment, `APP_SECRET_KEY` for sessions). Poster-flow is excluded from the default Vitest run because it requires a live server.

## Layout

- **`tests/*.test.ts`** – unit/integration tests (`describe` / `it` / `expect`).
- **`tests/backend.integration.test.ts`** – Fastify HTTP checks; optional `MOVIE_DB_API_KEY` enables the search-movie case.
- **`tests/fixtures/`** – HTML/JSON fixtures for scrapers and state tests.
- **`e2e/app.spec.ts`** – browser E2E (mocked APIs).

## Cross-layer imports from public src

A few Vitest files **import modules from the Vite app** on purpose so logic stays single-sourced:

| Test file                       | Imports                                          |
| ------------------------------- | ------------------------------------------------ |
| `stateTileManagement.test.ts`   | `public/src/movieTiles` (tab/tile state helpers) |
| `providerDeduplication.test.ts` | `public/src/providerUtils`                       |

If you rename or move those modules, run **`bun run test`** and the **frontend** test suite (`public/src/__tests__/`) together—they exercise the same code from different runners.

The browser bundle only imports **`lib/letterboxdListUrl`** from repo `lib/` today; avoid adding more `../../lib/*` imports from `public/src/` without a dedicated small helper module so coupling and bundle size stay predictable.

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

## Legacy `testUtils.ts`

`tests/testUtils.ts` (custom `TestSuite` / `assert*`) is **deprecated** for new tests; prefer Vitest. It can remain for any one-off scripts if needed.
