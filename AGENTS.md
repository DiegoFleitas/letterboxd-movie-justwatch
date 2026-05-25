# letterboxd-movie-justwatch

## Package manager

Bun only (`packageManager: bun@1.3.11`). No Node/nvm version pin.

## Essential commands

| Command                              | What                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `bun run dev`                        | Vite (5173) + Fastify (3000) concurrently (see `concurrently` in scripts). Vite proxies `/api` → `localhost:3000`. |
| `bun run typecheck`                  | Runs **two** separate `tsc --noEmit` — once at root, once inside `src/client/`.                                    |
| `bun run lint`                       | ESLint (`.ts,.tsx`).                                                                                               |
| `bun run knip`                       | Unused deps/files/exports (does NOT flag type exports — `rules.types: off` in `knip.json`).                        |
| `bun run test` / `bun run test:unit` | All Vitest tests.                                                                                                  |
| `bun run test:coverage`              | Vitest with coverage (80% threshold on statements/lines only).                                                     |

Order before PR: `bun run lint && bun run typecheck && bun run knip && bun run test`.

## Test shortcuts

- `bun run test:backend` — Fastify integration tests only
- `bun run test:redis`, `test:dedupe`, `test:filter`, `test:state`, `test:posthog` — single files
- `bun run test:e2e` — Playwright (`tests/e2e/*.spec.ts`)

## Architecture

- **Backend**: Bun + Fastify, entry `src/server/main.ts` → `createServer.ts`
- **Frontend**: React 19 + Vite, root `src/client/`, entry `src/client/index.html`
- **Two `tsconfig.json`** files: root (server, NodeNext) and `src/client/tsconfig.json` (client, ESNext/bundler)
- **Path aliases**: `@server/*` → `src/server/*`, `@/*` → `src/client/src/*`. Both `tsconfig.json` and `vitest.config.ts` mirror these.
- **Client import boundary**: Only `@server/lib/letterboxdListUrl` is imported from the client app. Avoid pulling more server modules into the browser bundle.
- **Redis** caching with snapshot export/seed scripts (`redis/scripts/`)

## Commit format

`type(scope): action specific-thing` — types: `feat`, `fix`, `docs`, `ci`, `refactor`, `test`, `chore`. See `.gitmessage`.

## Notable quirks

- `import` paths use `.js` extensions in source (Bun ESM).
- Vitest runs with `globals: true` (no explicit imports needed for `describe`/`it`/`expect`).
- `vitest.config.ts` provides a default `APP_SECRET_KEY` env — tests run without needing `.env`.
- `eslint-plugin-import` rules `import/no-unresolved` and `import/named` are **off** (TS handles resolution).
- Husky pre-commit runs `lint-staged` (format + fix staged files); pre-push runs `lint`.
- Docker Compose starts both app and Redis (`redis:7-alpine`).
- Dev debug bar (`VITE_DEV_DEBUG_BAR`) shown by default in dev; set `false` to hide.
