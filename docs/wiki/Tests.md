# Tests

Unit and integration tests use **[Vitest](https://vitest.dev/)**. Browser end-to-end tests use **Playwright** in [`tests/e2e/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests/e2e); see [E2E Playwright](E2E-Playwright).

## Commands

| Command                                                                          | What it runs                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test` / `bun run test:unit`                                             | All Vitest tests matching `test.include` in [`vitest.config.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/vitest.config.ts)                                    |
| `bun run test:coverage`                                                          | Same Vitest run with **v8 coverage** (`text`, `lcov`, `html` under `coverage/`; `lcov.info` is uploaded from CI to [Codecov](https://codecov.io/gh/DiegoFleitas/letterboxd-movie-justwatch)) |
| `bun run test:backend`                                                           | Fastify integration tests only                                                                                                                                                               |
| `bun run test:filter`, `test:state`, `test:posthog`, `test:redis`, `test:dedupe` | Single Vitest entry points                                                                                                                                                                   |
| `bun run test:e2e`                                                               | Playwright (`tests/e2e/*.spec.ts`, including `backend-smoke.spec.ts`)                                                                                                                        |
| `bun run test:poster-flow`                                                       | Manual script against `localhost:3000`; **not** part of `bun run test`                                                                                                                       |

Configuration: root [`vitest.config.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/vitest.config.ts) (Node environment, `APP_SECRET_KEY` for sessions). **`test:poster-flow`** is not Vitest: it runs the standalone Bun script [`scripts/testPosterFlow.manual.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/scripts/testPosterFlow.manual.ts) against a live backend on `localhost:3000`.

**Codecov:** CI uploads `coverage/lcov.info` via [`codecov/codecov-action`](https://github.com/codecov/codecov-action). Add the repository on [codecov.io](https://codecov.io) and store the repo upload token as **`CODECOV_TOKEN`** in GitHub **Settings → Secrets and variables → Actions** so uploads from the default branch are reliable (fork PRs can still upload tokenless per Codecov’s OSS rules).

More script names: [Commands](Commands).

## Path aliases

See root [`tsconfig.json`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/tsconfig.json) and Vitest `resolve.alias`: `@server/…` → `src/server/…`, `@/…` → `src/client/src/…`. Prefer these over long `../src/...` chains in new tests.

## Layout

| Path                                                                                                                                            | Role                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`tests/*.test.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests)                                               | Unit and integration tests                                                     |
| [`tests/backend.integration.test.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/tests/backend.integration.test.ts) | Fastify HTTP checks; optional `MOVIE_DB_API_KEY` enables the search-movie case |
| [`tests/fixtures/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests/fixtures)                                      | HTML/JSON fixtures — [Test fixtures](Test-fixtures)                            |
| [`tests/goldens/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests/goldens)                                        | Optional golden JSON — [Test goldens](Test-goldens)                            |

## Cross-layer imports from client `src`

Some Vitest files import **client app** modules on purpose so logic stays single-sourced:

| Test file                       | Imports (`@/` alias) |
| ------------------------------- | -------------------- |
| `stateTileManagement.test.ts`   | `@/movieTiles`       |
| `providerDeduplication.test.ts` | `@/providerUtils`    |

If you rename those modules, run **`bun run test`** and the **frontend** tests under `src/client/src/__tests__/` together.

## Adding a test

1. Add `tests/yourFeature.test.ts` (or follow existing naming).
2. Use Vitest `describe` / `it` / `expect`.
3. Optionally add `package.json` script, e.g. `"test:yourfeature": "bunx vitest run tests/yourFeature.test.ts"`.
