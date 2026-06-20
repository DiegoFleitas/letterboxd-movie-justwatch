# letterboxd-movie-justwatch

## Package manager

Bun only (`packageManager: bun@1.3.11`). No Node/nvm version pin.

## Essential commands

| Command                   | What                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `bun run dev`             | Vite (5173) + Fastify (3000) concurrently (see `concurrently` in scripts). Vite proxies `/api` → `localhost:3000`. |
| `bun run fe:dev`          | Vite only (frontend dev server on 5173).                                                                           |
| `bun run be:dev`          | Fastify only (`bun --hot src/server/main.ts`).                                                                     |
| `bun run typecheck`       | Runs **two** separate `tsc --noEmit` — once at root, once inside `src/client/`.                                    |
| `bun run lint`            | ESLint (`.ts,.tsx`).                                                                                               |
| `bun run format:check`    | Prettier check across all file types.                                                                              |
| `bun run format:write`    | Prettier write across all file types.                                                                              |
| `bun run knip`            | Unused deps/files/exports (does NOT flag type exports — `rules.types: off` in `knip.json`).                        |
| `bun run test`            | All Vitest tests.                                                                                                  |
| `bun run test:coverage`   | Vitest with coverage (80% threshold on statements/lines only).                                                     |
| `bun run build:providers` | Rebuild canonical provider map from remote data source.                                                            |

Order before PR: `bun run lint && bun run typecheck && bun run knip && bun run test`.

## Test shortcuts

- `bunx vitest run tests/someFeature.test.ts` — run a single test file
- `bun run test:backend` — Fastify integration tests only
- `bun run test:redis`, `test:dedupe`, `test:filter`, `test:state`, `test:posthog` — single files
- `bun run test:e2e` — Playwright (`tests/e2e/*.spec.ts`). Two kinds: **mocked UI flows** (route-intercept `/api/*`) and **`backend-smoke.spec.ts`** (real HTTP to Fastify; requires `bun run dev` running first). Override backend URL with `E2E_API_BASE_URL` (default `http://127.0.0.1:3000`). Playwright's `webServer` only waits on port 5173 (Vite) — the backend must already be up. Artifacts: `tests/playwright-report/`, `tests/test-results/`.
- **Fixtures**: `tests/fixtures/` — HTML/JSON used by unit tests. Update with `bun run update:letterboxd-fixtures`.
- **Goldens**: `tests/goldens/` — optional JSON golden files for snapshot-style assertions.
- Two Vitest files import client modules (`@/` alias): `stateTileManagement.test.ts` (`@/utils/movieTiles`) and `providerDeduplication.test.ts` (`@/utils/providerUtils`). If those modules are renamed, run both test suites.

## Architecture

- **Backend**: Bun + Fastify, entry `src/server/main.ts` → `createServer.ts`. Wiring: `registerFastifyWiring.ts` orchestrates all plugin/route registrations (session, static, API, dev routes, Sentry).
- **Frontend**: React 19 + Vite, root `src/client/`, entry `src/client/index.html`
- **Controllers** (`src/server/controllers/`): HTTP handlers — lists, search, posters, PostHog proxy, HTTPS proxy, Jackett alternative search, subdl.
- **Lib** (`src/server/lib/`): Shared backend utilities — axios config, Redis client, Letterboxd scraping (Cheerio), canonical provider loading, API schemas (Zod), PostHog, Sentry capture helpers. Domain/API types in `src/server/lib/types/`.
- **Route constants** (`src/server/routes.ts`): All API path strings, shared between Fastify and the Vite client via `@server/routes` import.
- **Two `tsconfig.json`** files: root (server, NodeNext) and `src/client/tsconfig.json` (client, ESNext/bundler)
- **Path aliases**: `@server/*` → `src/server/*`, `@/*` → `src/client/src/*`. Defined in root `tsconfig.json`, `src/client/tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`.
- **Client import boundary**: Only `@server/lib/letterboxdListUrl` is imported from the client app. Do not pull additional server modules into the browser bundle.
- **Redis** caching with snapshot export/seed scripts (`redis/scripts/`). See `bun run redis:reset` and `redis/README.md`.

## Project structure

```
letterboxd-movie-justwatch/
├── src/
│   ├── server/                          # Fastify backend
│   │   ├── main.ts                      # Entry point
│   │   ├── createServer.ts              # Server factory
│   │   ├── registerFastifyWiring.ts     # Plugin/route orchestration
│   │   ├── routes.ts                    # API path constants (shared with client via @server/routes)
│   │   ├── buildIndexHtmlForClient.ts
│   │   ├── fastifyHttpBridge.ts
│   │   ├── httpContext.ts
│   │   ├── httpStatusCodes.ts
│   │   ├── instrument.ts                # Sentry init
│   │   ├── registerFastifyAppApi.ts
│   │   ├── registerFastifySessionPlugins.ts
│   │   ├── registerFastifyStaticAndIndex.ts
│   │   ├── registerDevHttpRoutes.ts
│   │   ├── controllers/                 # HTTP handlers
│   │   │   ├── letterboxdLists.ts       # Letterboxd list scraping + JustWatch enrichment
│   │   │   ├── searchMovie.ts           # TMDb movie search
│   │   │   ├── poster.ts                # OMDb poster lookup
│   │   │   ├── letterboxdPoster.ts      # Letterboxd poster scraping
│   │   │   ├── posthogProxy.ts          # PostHog analytics proxy
│   │   │   ├── proxy.ts                 # Generic HTTPS proxy
│   │   │   ├── alternativeSearch.ts     # Jackett torrent search
│   │   │   ├── subdlSearch.ts           # Subdl subtitle search
│   │   │   └── index.ts                 # Barrel exports
│   │   └── lib/                         # Shared backend utilities
│   │       ├── apiSchemas.ts            # Zod request/response schemas
│   │       ├── axios.ts                 # Axios instance config
│   │       ├── redis.ts                 # Redis client
│   │       ├── memoryCache.ts           # In-process cache (used when DISABLE_REDIS=1)
│   │       ├── httpRetryConfig.ts      # Axios retry on 429
│   │       ├── canonicalProviders.ts    # Provider map data
│   │       ├── loadCanonicalProviders.ts
│   │       ├── letterboxdListHtml.ts    # Cheerio HTML scraping
│   │       ├── letterboxdHttp.ts        # Letterboxd HTTP client
│   │       ├── letterboxdListUrl.ts     # URL parsing (also imported by client)
│   │       ├── letterboxdFetchTimeout.ts
│   │       ├── letterboxdStableFilmLink.ts
│   │       ├── justWatchOutbound.ts     # JustWatch GraphQL client
│   │       ├── processOffers.ts         # JustWatch offer normalisation
│   │       ├── posthog.ts
│   │       ├── sentryCapture.ts              # Sentry capture helpers + traces sample rate
│   │       ├── devApiGuard.ts
│   │       ├── injectRuntimeConfig.ts
│   │       ├── scrapeUserAgent.ts
│   │       ├── subdlBrowseUrl.ts
│   │       └── types/index.ts           # Domain/API types
│   └── client/                          # React 19 + Vite frontend
│       ├── index.html                   # Vite entry point
│       ├── tsconfig.json                # Client TS config (ESNext/bundler)
│       ├── css/                         # Component stylesheets
│       ├── icons/                       # SVG icons (static)
│       ├── assets/                      # SVG icon imports (via Vite)
│       └── src/
│           ├── main.tsx                 # React root
│           ├── App.tsx                  # Root component; wires panels + context
│           ├── components/              # React UI components
│           │   ├── AppStateContext.tsx  # Global state (list URL, country, tiles, filters)
│           │   ├── LeftPanel.tsx        # List URL form + movie search tab
│           │   ├── RightPanel.tsx       # Movie tile grid + filters
│           │   ├── MovieTile.tsx        # Individual movie card
│           │   ├── CountrySelector.tsx
│           │   ├── DevDebugBar.tsx / DevDebugBarGate.tsx
│           │   ├── ToastProvider.tsx / WaitCue.tsx / SimpleWaitDots.tsx
│           │   └── VirtualizedPosterShowcase.tsx
│           ├── hooks/                   # Custom React hooks
│           │   ├── useLetterboxdList.ts # Primary data-fetching hook
│           │   ├── useMovieSearch.ts    # Movie search hook
│           │   └── useMobilePosterLayout.ts
│           ├── utils/                   # Pure utilities (no DOM/React deps)
│           │   ├── movieTiles.ts        # Tile state management
│           │   ├── providerUtils.ts     # Provider deduplication logic
│           │   ├── alternativeSearch.ts
│           │   ├── fetchSearchMovie.ts
│           │   └── showError.ts / showMessage.ts / sentry.ts / …
│           ├── data/                    # Static data / app-wide constants
│           │   ├── countries.ts / countryGeo.ts
│           │   ├── genres.ts / consts.ts
│           ├── animation/timing.ts
│           └── __tests__/              # Client-side Vitest tests
├── tests/                              # Backend/shared Vitest tests
│   ├── e2e/                            # Playwright specs (mocked UI + backend-smoke)
│   ├── fixtures/                       # HTML/JSON used by unit tests
│   ├── goldens/                        # Optional JSON golden files
│   └── helpers/                        # Shared test utilities
├── scripts/                            # Utility scripts
│   ├── updateLetterboxdFixtures.ts
│   └── syncApiFixturesFromRedisSnapshot.ts
├── redis/                              # Redis tooling
│   ├── Dockerfile / entrypoint.sh
│   └── scripts/                        # export / seed / validate / buildCanonicalProviders
├── devops/fly-ops/                     # Fly.io management scripts
├── .github/workflows/                  # CI, deploy, cost report, dependabot auto-merge
├── tsconfig.json                       # Root TS config (server, NodeNext)
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.mjs / knip.json
├── fly.toml / Dockerfile / docker-compose.yml
└── .env.example
```

## Git conventions

- **Commit messages:** Use [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` — new feature
  - `fix:` — bug fix
  - `docs:` — documentation only
  - `chore:` — maintenance, deps, tooling
  - `refactor:` — code change with no fix/feature
  - `style:` — formatting, missing semicolons, etc.
  - `perf:` — performance improvement
  - `test:` — adding or fixing tests
  - Scope optional, e.g. `feat(proxy):`, `fix(graph):`
  - Keep subject line under 72 chars, lowercase after colon, no trailing period
  - Body paragraphs wrapped at 72 chars, blank line between subject and body
- **Atomic commits only**: stage only the files relevant to the change. Never stage everything (`git add .`, `git add -A`). Inspect `git status` and `git diff` first, then stage specific files.
- **No pushing to remote**. Commits are local-only. Never run `git push`.

### Devops

- **fly-ops** at `devops/fly-ops/`: Bash scripts for Fly.io inventory, cost estimation, and resource pruning.
  - `bun run fly:audit` — full inventory + cost estimate
  - `bun run fly:inventory` — apps, machines, volumes, Redis
  - `bun run fly:cost` — JSON cost estimate
  - `bun run fly:volumes:prune` — dry-run destroy unattached volumes
  - `bun run fly:memory:check` — per-app memory usage vs. limit
  - `bun run fly:redis:audit` — list all Redis instances, plans, and regions
  - `bun run fly:redis:prune` — destroy unattached Redis instances (with confirmation)
  - Requires `flyctl` + `jq` on PATH.
- Weekly cost report via `.github/workflows/fly-cost-report.yml` (Monday 9am UTC, needs `FLY_API_TOKEN` secret).

## Redis local dev

```bash
bun run redis:reset   # validate + seed (or export + validate + seed if snapshot missing)
bun run export-redis  # export running Redis → redis/data/redis-snapshot.json
bun run seed-redis    # restore snapshot → local Redis
```

Scripts reject non-local hosts by default; set `ALLOW_NON_LOCAL_REDIS=1` to override. Key prefix controlled by `FLY_APP_NAME` (defaults to `app`). Use `SEED_REDIS_URL` to target a specific Redis instance for seeding (falls back to `FLYIO_REDIS_URL` / localhost).

Docker custom image (Redis + flyctl, for CLI workflows):

```bash
cd redis && docker build -t redis-cli-flyctl . && docker run -d -p 6379:6379 redis-cli-flyctl
```

Then set `FLYIO_REDIS_URL=redis://localhost:6379` in `.env`.

## Key environment variables

| Variable                                              | Notes                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `FLYIO_REDIS_URL`                                     | e.g. `redis://localhost:6379`                                            |
| `DISABLE_REDIS`                                       | `1` skips Redis (used in CI and production)                              |
| `OMDB_API_KEY`                                        | Poster lookups                                                           |
| `MOVIE_DB_API_KEY`                                    | TMDb search; enables extra integration coverage in CI                    |
| `APP_SECRET_KEY`                                      | ≥32 chars, required in production for sessions                           |
| `JACKETT_API_KEY` / `JACKETT_API_ENDPOINT`            | Optional alternative search                                              |
| `PORT`                                                | Backend port (default 3000)                                              |
| `SENTRY_DSN`                                          | Enables Sentry on backend and (via runtime injection) frontend           |
| `SENTRY_RELEASE`                                      | Must match between backend runtime and sourcemap upload                  |
| `SENTRY_TRACES_SAMPLE_RATE`                           | Float 0–1; defaults to 0.1 in production, 0 in dev                       |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Required for sourcemap upload                                            |
| `E2E_API_BASE_URL`                                    | Override Playwright smoke test backend (default `http://127.0.0.1:3000`) |

Full list: `.env.example` (table above reflects all documented vars, some of which are omissible in local dev).

## Sentry sourcemap release

```bash
bun run sentry:release:new
bun run sentry:release:upload-sourcemaps
bun run sentry:release:finalize
# or combined:
bun run sentry:release:frontend
```

`SENTRY_RELEASE` must be identical at runtime (backend init + frontend `window.__SENTRY_RELEASE__`) and during sourcemap upload — CI derives it from `github.sha`.

## 2026-05-28 Cost reduction

- Removed Upstash Redis (`DISABLE_REDIS=1`, instance destroyed) — saved ~$5/mo
- Shrunk `movie-justwatch` VM from 1gb to 256mb — saved ~$2/mo
- Net effect: raw spend ~$18.53 → ~$3.84, billable $12.26 → ~$0
- Jackett app (`bold-feather-1773`) kept at 1gb, fits within free allowance
- Production runs with `DISABLE_REDIS=1` (in-process cache). Redis is only used in local dev / Docker Compose.

# Notable quirks

- `import` paths use `.js` extensions in source (Bun ESM).
- Vitest runs with `globals: true` (no explicit imports needed for `describe`/`it`/`expect`).
- `vitest.config.ts` provides a default `APP_SECRET_KEY` env — tests run without needing `.env`.
- `eslint-plugin-import` rules `import/no-unresolved` and `import/named` are **off** (TS handles resolution).
- Husky pre-commit runs `lint-staged` (format + fix staged files); pre-push runs `lint`. The `pre-commit` hook appends `~/.bun/bin` to PATH for Git GUIs that omit it.
- Docker Compose starts both app and Redis (`redis:7-alpine`).
- Dev debug bar (`VITE_DEV_DEBUG_BAR`) shown by default in dev; set `false` to hide.
- PostHog uses **separate** env vars for frontend (`VITE_PUBLIC_POSTHOG_KEY`/`VITE_PUBLIC_POSTHOG_HOST`) and backend (`POSTHOG_KEY`/`POSTHOG_HOST`). Leave unset for local dev.
- Coverage thresholds: 80% on statements/lines only (no branch/function threshold).
