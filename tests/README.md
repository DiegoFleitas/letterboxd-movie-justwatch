# Tests

Unit and integration tests use **[Vitest](https://vitest.dev/)**. End-to-end tests use **Playwright** (`e2e/`).

## Commands

| Command                                                                           | What it runs                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm test` / `pnpm run test:unit`                                                | All Vitest tests under `tests/**/*.test.ts` (see exclusions in `vitest.config.ts`)          |
| `pnpm run test:backend`                                                           | Fastify integration tests only                                                              |
| `pnpm run test:filter`, `test:state`, `test:posthog`, `test:redis`, `test:dedupe` | Single Vitest files                                                                         |
| `pnpm run test:e2e`                                                               | Playwright (`e2e/app.spec.ts`)                                                              |
| `pnpm run test:poster-flow`                                                       | Manual script: hits `localhost:3000` (backend must be running); **not** part of `pnpm test` |

Config: root [`vitest.config.ts`](../vitest.config.ts) (Node environment, `APP_SECRET_KEY` for sessions). Poster-flow is excluded from the default Vitest run because it requires a live server.

## Layout

- **`tests/*.test.ts`** – unit/integration tests (`describe` / `it` / `expect`).
- **`tests/backend.integration.test.ts`** – Fastify HTTP checks; optional `MOVIE_DB_API_KEY` enables the search-movie case.
- **`tests/fixtures/`** – HTML/JSON fixtures for scrapers and state tests.
- **`e2e/app.spec.ts`** – browser E2E (mocked APIs).

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

3. Optional: add a script in `package.json`, e.g. `"test:yourfeature": "pnpm exec vitest run tests/yourFeature.test.ts"`.

## Legacy `testUtils.ts`

`tests/testUtils.ts` (custom `TestSuite` / `assert*`) is **deprecated** for new tests; prefer Vitest. It can remain for any one-off scripts if needed.
