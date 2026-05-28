# letterboxd-movie-justwatch

## Package manager

Bun only (`packageManager: bun@1.3.11`). No Node/nvm version pin.

## Essential commands

| Command                              | What                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `bun run dev`                        | Vite (5173) + Fastify (3000) concurrently (see `concurrently` in scripts). Vite proxies `/api` → `localhost:3000`. |
| `bun run fe:dev`                     | Vite only (frontend dev server on 5173).                                                                           |
| `bun run be:dev`                     | Fastify only (`bun --hot src/server/main.ts`).                                                                     |
| `bun run typecheck`                  | Runs **two** separate `tsc --noEmit` — once at root, once inside `src/client/`.                                    |
| `bun run lint`                       | ESLint (`.ts,.tsx`).                                                                                               |
| `bun run format:check`               | Prettier check across all file types.                                                                              |
| `bun run format:write`               | Prettier write across all file types.                                                                              |
| `bun run knip`                       | Unused deps/files/exports (does NOT flag type exports — `rules.types: off` in `knip.json`).                        |
| `bun run test` / `bun run test:unit` | All Vitest tests.                                                                                                  |
| `bun run test:coverage`              | Vitest with coverage (80% threshold on statements/lines only).                                                     |
| `bun run build:providers`            | Rebuild canonical provider map from remote data source.                                                            |

Order before PR: `bun run lint && bun run typecheck && bun run knip && bun run test`.

## Test shortcuts

- `bun run test:backend` — Fastify integration tests only
- `bun run test:redis`, `test:dedupe`, `test:filter`, `test:state`, `test:posthog` — single files
- `bun run test:e2e` — Playwright (`tests/e2e/*.spec.ts`). Two kinds: **mocked UI flows** (route-intercept `/api/*`) and **`backend-smoke.spec.ts`** (real HTTP to Fastify).

## Architecture

- **Backend**: Bun + Fastify, entry `src/server/main.ts` → `createServer.ts`. Controllers in `src/server/controllers/`. Wiring: `registerFastifyWiring.ts` calls session, static, API, dev, and Sentry route registrations.
- **Frontend**: React 19 + Vite, root `src/client/`, entry `src/client/index.html`
- **Two `tsconfig.json`** files: root (server, NodeNext) and `src/client/tsconfig.json` (client, ESNext/bundler)
- **Path aliases**: `@server/*` → `src/server/*`, `@/*` → `src/client/src/*`. Both `tsconfig.json` and `vitest.config.ts` mirror these.
- **Client import boundary**: Only `@server/lib/letterboxdListUrl` is imported from the client app. Avoid pulling more server modules into the browser bundle.
- **Redis** caching with snapshot export/seed scripts (`redis/scripts/`). See `bun run redis:reset` and `redis/README.md`.

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
  - Requires `flyctl` + `jq` on PATH.
- Weekly cost report via `.github/workflows/fly-cost-report.yml` (Monday 9am UTC, needs `FLY_API_TOKEN` secret).

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
