## Letterboxd Movie JustWatch

[![Tests](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/<YOUR_GITHUB_USERNAME>/letterboxd-movie-justwatch/actions/workflows/ci.yml)

Scan any **public** Letterboxd watchlist or custom list and see where each film is streaming in your country. Uses **unofficial** JustWatch-style data without recommendation clutter, with optional **Jackett**-backed alternative search.

### What it does

- **Watchlists**: Paste a Letterboxd watchlist or list URL; the app scrapes/fetches titles and resolves streaming availability per film.
- **Per-country availability**: Choose a country and see which services carry each title there.
- **Caching**: Redis-backed cache to reduce repeat calls to external APIs (see [`redis/README.md`](redis/README.md) for CLI, export/seed).
- **Alternative search**: Optional Jackett integration for harder-to-find titles.

### Tech stack

- **Frontend**: React 19 + Vite (`public/`)
- **Backend**: Node + **Fastify** (TypeScript, `tsx`) — `server-fastify.ts` / `server/createServer.ts`. An **Express** entry (`server-express.ts`) remains available for alternate runs.
- **Data**: Cheerio (Letterboxd), axios, ioredis, sessions via Fastify
- **Quality**: Vitest, Playwright, ESLint, Prettier, Husky

### Prerequisites

- **Node.js** (LTS recommended)
- **pnpm** — lockfile targets `pnpm@10.x` (see `packageManager` in `package.json`)

### Quick start (local dev)

1. `pnpm install`
2. `cp .env.example .env` and set at least **`FLYIO_REDIS_URL`**, **`OMDB_API_KEY`** (posters). For production, set **`APP_SECRET_KEY`** (≥32 characters for sessions).
3. `pnpm run dev` — runs Vite on **5173** and Fastify on **3000** (see `concurrently` in `package.json`).
4. Open **`http://localhost:5173`** (dev UI proxies API traffic to the backend as configured in Vite).

### Docker Compose

```bash
docker compose up --build
```

Then open **`http://localhost:3000`**. For secrets (`OMDB_API_KEY`, `APP_SECRET_KEY`, etc.), use a root `.env` or `docker-compose.override.yml`; Compose loads `.env` automatically.

### Project layout (high level)

| Path                                      | Role                                                              |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `public/`                                 | Vite root: React app (`src/`), static assets, CSS                 |
| `server/createServer.ts`                  | Fastify app wiring (routes, static, sessions)                     |
| `server-fastify.ts` / `server-express.ts` | Process entrypoints                                               |
| `controllers/`                            | HTTP handlers (Letterboxd lists, search, posters, proxy, Jackett) |
| `helpers/`, `lib/`                        | Scraping, CSV, URL helpers                                        |
| `scripts/`                                | Provider build, Letterboxd fixtures, Redis export/seed            |
| `tests/`                                  | Vitest unit/integration                                           |
| `e2e/`                                    | Playwright (UI mocks + backend smoke)                             |

### Key commands

| Command                                         | Purpose                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm run dev`                                  | Vite + Fastify together                                                                                       |
| `pnpm run fe:dev` / `pnpm run be:dev`           | Frontend or backend only                                                                                      |
| `pnpm run start`                                | Production-style: `tsx server-fastify.ts`                                                                     |
| `pnpm run build`                                | Vite production build → `dist/`                                                                               |
| `pnpm test`                                     | All Vitest tests ([`tests/README.md`](tests/README.md))                                                       |
| `pnpm run test:e2e`                             | Playwright — run **`pnpm run dev`** first so backend is up for smoke tests ([`e2e/README.md`](e2e/README.md)) |
| `pnpm run test:poster-flow`                     | Manual poster checks against **localhost:3000** (not part of `pnpm test`)                                     |
| `pnpm run typecheck`                            | TypeScript (root + `public/`)                                                                                 |
| `pnpm run lint` / `pnpm run format:check`       | ESLint / Prettier                                                                                             |
| `pnpm run build:providers`                      | Regenerate canonical provider data (`build:providers:dry-run` to preview)                                     |
| `pnpm run export-redis` / `pnpm run seed-redis` | Redis snapshot ([`redis/README.md`](redis/README.md))                                                         |
| `pnpm run fly:deploy`                           | Build + Fly.io deploy (`fly:logs`, `fly:ssh`, etc.)                                                           |

### Configuration (environment)

See **`.env.example`** for the full list. Common variables:

| Variable                                   | Notes                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_SECRET_KEY`                           | **Required in production**; ≥32 chars (Fastify session). Local `pnpm dev` can use a dev default if unset.                               |
| `FLYIO_REDIS_URL`                          | e.g. `redis://localhost:6379`. Omit or avoid pointing production deploys at local Redis ([`redis/README.md`](redis/README.md) gotchas). |
| `DISABLE_REDIS`                            | `1` / `true` skips Redis (typical in CI).                                                                                               |
| `OMDB_API_KEY`                             | Poster lookups                                                                                                                          |
| `MOVIE_DB_API_KEY`                         | TMDb / search; optional locally; enables extra integration coverage in CI when set                                                      |
| `POSTHOG_KEY` / `POSTHOG_HOST`             | Optional analytics                                                                                                                      |
| `JACKETT_API_KEY` / `JACKETT_API_ENDPOINT` | Optional alternative search                                                                                                             |
| `CACHE_TTL`                                | Optional cache TTL override (seconds)                                                                                                   |
| `PORT`                                     | Backend port (default **3000**)                                                                                                         |
| `E2E_API_BASE_URL`                         | Playwright backend smoke base URL (default `http://127.0.0.1:3000`)                                                                     |

### Contributing & license

- Before a PR: `pnpm run lint`, `pnpm run typecheck`, and `pnpm test`. E2E details: [`e2e/README.md`](e2e/README.md).
- **License**: ISC (see `package.json`).

### Logging and secrets

- HTTP requests are logged via a shared axios helper (`helpers/axios.ts`) that **redacts query parameters such as `api_key`, `apikey`, `access_token`, `token`, and `key`** before printing URLs.
- Do not log raw environment variables or full external URLs containing credentials; if you add new HTTP clients, either use the existing helper or apply similar redaction.

### JustWatch API note

This project uses **unofficial** JustWatch-related endpoints for **non-commercial, personal** use only. For commercial use or official data, contact JustWatch. Endpoints may change or stop working at any time; use at your own risk.
