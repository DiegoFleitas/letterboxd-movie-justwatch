# Repository layout

| Path                         | Role                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/`                | Vite app root: React (`src/`), static assets, styles                                                                                                          |
| `src/server/main.ts`         | Process entrypoint (Fastify + Sentry bootstrap)                                                                                                               |
| `src/server/createServer.ts` | Fastify wiring: routes, static files, sessions                                                                                                                |
| `src/server/controllers/`    | HTTP handlers (lists, search, posters, proxy, Jackett)                                                                                                        |
| `resources/data/`            | Checked-in JSON (`canonical-providers.json`); optional local `redis-snapshot.json` (gitignored by default)                                                    |
| `src/server/lib/`            | Shared backend utilities (axios, Redis, Letterboxd scraping, canonical providers, schemas, PostHog); domain/API types in `src/server/lib/types/`              |
| `redis/`                     | Redis image/entrypoint for local or Docker Compose                                                                                                            |
| `scripts/`                   | Provider build, Letterboxd fixtures, Redis export/seed                                                                                                        |
| `tests/`                     | Vitest unit and integration tests                                                                                                                             |
| `e2e/`                       | Playwright (UI mocks + backend smoke)                                                                                                                         |
| `docs/`                      | Wiki sources under `docs/wiki/`; Sentry/logging guide: [Sentry and logger](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/wiki/Sentry-and-logger) |

**Import aliases** (see root `tsconfig.json`, `src/client/tsconfig.json`, `vite.config.ts`, `vitest.config.ts`): `@server/…` → `src/server/…`; `@/…` → `src/client/src/…` (client app modules only).
