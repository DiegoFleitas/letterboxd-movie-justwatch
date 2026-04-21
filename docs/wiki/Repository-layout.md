# Repository layout

| Path                     | Role                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/`                | Vite app root: React (`src/`), static assets, styles                                                                                                          |
| `server/createServer.ts` | Fastify wiring: routes, static files, sessions                                                                                                                |
| `server-fastify.ts`      | Process entrypoint                                                                                                                                            |
| `controllers/`           | HTTP handlers (lists, search, posters, proxy, Jackett)                                                                                                        |
| `resources/data/`        | Checked-in JSON (`canonical-providers.json`); optional local `redis-snapshot.json` (gitignored by default)                                                    |
| `lib/`                   | Shared backend utilities (axios, Redis, Letterboxd scraping, canonical providers, schemas, PostHog); domain/API types in `lib/types/`                         |
| `redis/`                 | Redis image/entrypoint for local or Docker Compose                                                                                                            |
| `scripts/`               | Provider build, Letterboxd fixtures, Redis export/seed                                                                                                        |
| `tests/`                 | Vitest unit and integration tests                                                                                                                             |
| `e2e/`                   | Playwright (UI mocks + backend smoke)                                                                                                                         |
| `docs/`                  | Wiki sources under `docs/wiki/`; Sentry/logging guide: [Sentry and logger](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/wiki/Sentry-and-logger) |
