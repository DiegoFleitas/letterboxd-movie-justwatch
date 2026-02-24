# TypeScript Migration Plan

This document outlines a safe, incremental plan to migrate the letterboxd-movie-justwatch app from JavaScript to TypeScript **without losing functionality**. The app is ESM-only, with a Node/Express backend, Vite+React frontend, Node-run unit tests, and Playwright E2E tests.

---

## 1. Current state summary

| Area | Location | Count | Notes |
|------|----------|--------|------|
| **Backend** | `server.js`, `controllers/`, `middleware/`, `helpers/`, `lib/` | ~20 JS files | Express, Redis, PostHog, axios |
| **Frontend** | `public/src/`, `public/` | 8 JSX + ~15 JS | React 19, Vite, PostHog |
| **Tests** | `tests/*.test.js`, `e2e/app.spec.js` | 6 unit + 1 E2E | Unit tests run via `node`; Playwright for E2E |
| **Config** | Root | `vite.config.js`, `playwright.config.js` | |
| **Scripts** | `scripts/` (if present) | buildCanonicalProviders, export-redis, seed-redis | Referenced in package.json |

Critical paths to keep green:

- `pnpm test` (all unit tests)
- `pnpm run build` (Vite build)
- `pnpm run test:e2e` (Playwright)
- `pnpm run dev` (concurrent fe + be)
- `pnpm start` (production server)
- CI: unit tests → build; E2E with `pnpm run dev` + Playwright

---

## 2. Principles

- **Incremental**: Migrate in layers (config → shared/types → backend → frontend → tests → scripts). No big-bang rename.
- **Dual extension during migration**: Prefer adding types to existing `.js`/`.jsx` by renaming to `.ts`/`.tsx` file-by-file and fixing imports. Optionally allow `allowJs: true` so JS and TS can coexist until migration is done.
- **No behavior change**: No refactors beyond types and build/config. Same APIs, same env, same deployment.
- **CI as gate**: After each phase, CI must pass. Use a branch and keep master green.

---

## 3. Phase 0: Tooling and config (no source changes)

**Goal:** TypeScript and runtimes in place; existing JS still runs unchanged.

1. **Install dependencies**
   - `pnpm add -D typescript @types/node @types/express @types/react @types/react-dom`
   - Optional for backend/tests: `pnpm add -D tsx` (run `.ts` with Node without pre-compile).

2. **Add `tsconfig.json` at repo root**
   - `"compilerOptions"`: `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"strict": true`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"noEmit": true` (we rely on Vite for frontend and tsx/ts-node for backend if needed).
   - `"include"`: e.g. `["**/*.ts", "**/*.tsx"]` (expand as you add TS).
   - `"exclude"`: `["node_modules", "dist", "public/dist"]`.

3. **Optional: second tsconfig for frontend only**
   - e.g. `tsconfig.app.json` or `public/tsconfig.json` with `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"jsx": "react-jsx"`, and `include` only under `public/src`. Root tsconfig can reference it or you use one config with composite include.

4. **Vite**
   - Vite already supports `.ts`/`.tsx`; no config change required for TS. Later, when you rename `vite.config.js` → `vite.config.ts`, switch to `defineConfig` from `vite` (already in use).

5. **Playwright**
   - Playwright runs `.ts` tests by default with its own loader. When you rename `e2e/app.spec.js` → `e2e/app.spec.ts`, no extra config needed.

6. **Backend execution**
   - Option A: Use `tsx` to run `server.ts`: `"start": "tsx server.ts"`, `"be:dev": "nodemon server.ts"` (with `exec: 'tsx'`). No emit step.
   - Option B: Add a build step that compiles backend TS to a `dist/` (or `build/`) folder and run `node server.js` from there; then `"start": "node dist/server.js"` and ensure all backend imports resolve to compiled output. Option A is simpler for this app size.

7. **Unit tests**
   - Today: `node tests/foo.test.js`. After migration to TS: run with `tsx tests/foo.test.ts` (or `node --loader tsx`), or compile tests and run with node. Prefer `tsx` for simplicity: `"test": "tsx tests/filterLogic.test.ts && ..."` (after files are .ts).

**Checklist:** `pnpm test`, `pnpm run build`, `pnpm run dev`, `pnpm start` (if you already switched entry to tsx), and CI all still pass with **no** `.ts`/`.tsx` files yet.

**Status:** Phase 0 done. Added: `tsconfig.json`, devDependencies (typescript, @types/node, @types/express, @types/react, @types/react-dom, tsx), `typecheck` script, and placeholder `types/index.ts` so `pnpm run typecheck` passes.

---

## 4. Phase 1: Shared types and config files

**Goal:** Introduce TypeScript in low-risk places and define shared types for API/domain.

1. **Create `types/` or `shared/types/` (or keep in a single `types.ts` at root)**
   - Add types for:
     - API request/response shapes (e.g. search-movie, letterboxd-watchlist, poster).
     - Redis cache keys/values if you want type safety there.
     - Movie tile, provider, country, etc. (from `public/src/` and controllers).
   - Start with a few key interfaces; expand as you migrate controllers and frontend.

2. **Rename config files to TypeScript**
   - `vite.config.js` → `vite.config.ts` (Vite supports it; fix any type errors).
   - `playwright.config.js` → `playwright.config.ts`.
   - Ensure `tsconfig.json` includes these if they’re type-checked.

3. **Keep CI green**
   - Run `pnpm run build` and `pnpm test` (and E2E if you run it in this phase). Fix any config-related breakage.

**Status:** Phase 1 done. Added shared types in `types/index.ts` (MovieProvider, MovieTileData, SearchMovieRequestBody, SearchMovieResponse, LetterboxdListFilm, LetterboxdListResponse, CanonicalProviderMap). Renamed `vite.config.js` → `vite.config.ts`, `playwright.config.js` → `playwright.config.ts`. Typecheck, unit tests, and build pass.

---

## 5. Phase 2: Backend migration

**Goal:** All backend code in TypeScript; server and API behavior unchanged.

1. **Order of migration (suggested)**
   - **Helpers** (no Express): `helpers/redis.js`, `helpers/axios.js`, `helpers/processOffers.js`, `helpers/loadCanonicalProviders.js`, `helpers/canonicalProviders.js` → `.ts`. Use shared types where applicable (e.g. cache value shape).
   - **Lib**: `lib/posthog.js`, `lib/injectPosthogConfig.js` → `.ts`.
   - **Middleware**: `middleware/session.js`, `middleware/index.js` → `.ts`. Use `Request`/`Response` from `express` and your own extended types if needed.
   - **Controllers**: `controllers/searchMovie.js`, `poster.js`, `letterboxdLists.js`, `letterboxdPoster.js`, `alternativeSearch.js`, `proxy.js`, then `controllers/index.js` → `.ts`. Typing `(req, res)` as `Request`/`Response` (and `req.body` with your types) will catch most issues.
   - **Server**: `server.js` → `server.ts`. Update any dynamic imports or path usage; ensure `__dirname`/`import.meta` usage is valid in TS.

2. **Import rules**
   - Keep ESM. Use `.js` extensions in imports only if you compile to JS and run from `dist/`; if using `tsx`, you can use extension-less or `.ts` in imports (tsx resolves). Prefer the same style as today (e.g. `from "./redis.js"` → `from "./redis.ts"` or `"./redis.js"` for emitted JS).
   - If you use `noEmit: true` and run with tsx, write imports without extension or with `.ts`; tsx resolves. When switching to emit, align with Node ESM resolution (e.g. emit to `.js`, import `"./redis.js"`).

3. **Express typings**
   - Use `Request`, `Response`, `NextFunction` from `express`. For `req.body`, use interface augmentation or a generic middleware type so `req.body` is typed per route (or use a single shared body type for each controller).

4. **Scripts**
   - If `scripts/buildCanonicalProviders.js`, `export-redis-snapshot.js`, `seed-redis-from-snapshot.js` exist, migrate them to `.ts` and run with `tsx` (e.g. `"build:providers": "tsx scripts/buildCanonicalProviders.ts"`). Update package.json scripts accordingly.

5. **Entrypoint and start**
   - Point `main` or start script to `server.ts` with `tsx`, or to `dist/server.js` if you use a compile step. Ensure `be:dev` and `start` work and that production (e.g. Fly) runs the same path (e.g. `tsx server.ts` or `node dist/server.js` after build).

**Checklist:** All API routes respond as before; Redis, PostHog, and proxy behavior unchanged; `pnpm test` (if tests still JS) and `pnpm run build` pass; E2E passes.

**Status:** Phase 2 done. Backend fully migrated: helpers, lib, middleware, controllers, server, scripts, and unit tests are now TypeScript. Entry: `tsx server.ts`; tests: `tsx tests/*.test.ts`; scripts: `tsx scripts/*.ts`. All backend .js files removed. Typecheck, unit tests, and Vite build pass.

---

## 6. Phase 3: Frontend migration

**Goal:** All React and frontend code in TypeScript/TSX; bundle and runtime behavior unchanged.

1. **Order of migration**
   - **Non-React modules**: `public/src/consts.js`, `public/src/countries.js`, `public/src/countryGeo.js`, `public/src/generes.js`, `public/src/providerUtils.js`, `public/src/toastApi.js`, `public/src/showMessage.js`, `public/src/showError.js`, `public/src/noticeFunctions.js` → `.ts`. Add types for constants and function signatures.
   - **Hooks and state**: `public/src/useLetterboxdList.js`, `public/src/useMovieSearch.js`, `public/src/alternativeSearch.js` → `.ts`/`.tsx` if they contain JSX. Type hook return values and API response shapes using shared types.
   - **Components**: `public/src/App.jsx`, `public/src/AppStateContext.jsx`, `public/src/LeftPanel.jsx`, `public/src/RightPanel.jsx`, `public/src/MovieTile.jsx`, `public/src/ToastProvider.jsx`, `public/src/CountrySelector.jsx`, `public/src/main.jsx` → `.tsx`. Type props and state; use shared types for movie/provider/country.
   - **Entry**: `public/src/main.jsx` → `main.tsx`. Update `public/index.html` script src to `src/main.tsx` (or keep `/src/main.tsx`; Vite will resolve).
   - **Root-level JS**: `public/countrySelector.js` (if it’s separate from `CountrySelector.jsx`) → `.ts` or `.tsx` as appropriate.

2. **React typings**
   - Use `@types/react` and `@types/react-dom`. Prefer `React.FC<Props>` or explicit props interfaces. Type `window.__POSTHOG_KEY__` etc. via a small `global.d.ts` or `vite-env.d.ts` if needed.

3. **Vite and HTML**
   - Ensure `index.html` references the new entry (e.g. `src/main.tsx`). Vite will resolve and bundle. No change to dev or build behavior beyond file extensions.

**Checklist:** `pnpm run build` succeeds; `pnpm run dev` loads the app; E2E tests pass; no console errors or missing providers/config.

**Status:** Phase 3 done. All frontend code migrated to TypeScript/TSX. Root tsconfig excludes `public/src`; `pnpm run typecheck` runs root tsc (backend) then `cd public && tsc --noEmit` (frontend with `public/tsconfig.json`, moduleResolution bundler). Added `public/src/vite-env.d.ts` (Window, react-hot-toast), fixed types (MergeData, BatchError, ProviderLike, etc.). Removed all `public/src/*.js` and `public/src/*.jsx`. `index.html` references `/src/main.tsx`. Typecheck, build, and unit tests pass.

---

## 7. Phase 4: Tests migration

**Goal:** All tests in TypeScript; same coverage and assertions.

1. **Unit tests**
   - Rename `tests/testUtils.js` → `tests/testUtils.ts` (add types to `TestSuite` and assertion helpers).
   - Rename each `tests/*.test.js` → `tests/*.test.ts`. Fix imports; use shared types for mocks and fixtures. Keep the same test names and logic.
   - Update `package.json` scripts to run `.ts` files (e.g. `tsx tests/filterLogic.test.ts && ...` or a single `tsx tests/run-all.ts` that imports and runs all suites). Alternatively use Vitest (already in devDependencies) for `tests/**/*.test.ts` with a single `pnpm test` command; then you can remove the custom `TestSuite` runner later if desired.

2. **E2E**
   - Rename `e2e/app.spec.js` → `e2e/app.spec.ts`. Playwright will run it as-is. Fix any type errors in expectations or selectors.

3. **CI**
   - No change to CI steps; same commands `pnpm test` and `pnpm run build` and `pnpm run test:e2e`. Ensure Playwright still starts the app with `pnpm run dev` and that the server entry is the chosen TS entry (e.g. tsx).

**Checklist:** `pnpm test` and `pnpm run test:e2e` pass; CI green.

**Status:** Phase 4 done. E2E migrated: `e2e/app.spec.js` → `e2e/app.spec.ts` (typed with Playwright `Page`, fixture types). Orphan unit tests migrated: `tests/testPosterUrlConstruction.test.js` → `tests/testPosterUrlConstruction.test.ts` (included in `pnpm test`), `tests/testPosterFlow.test.js` → `tests/testPosterFlow.test.ts` (optional `pnpm run test:poster-flow`, requires server). Old .js test files removed. Typecheck, unit tests pass.

---

## 8. Phase 5: Cleanup and strictness

**Goal:** Full TypeScript coverage and stricter checks.

1. **Remove `allowJs`** (if used): Ensure no `.js`/`.jsx` remain in included paths, or leave `allowJs` for any legacy script you decide not to migrate.

2. **Stricter options**: Consider `noImplicitAny`, `strictNullChecks` (if not already under `strict`), and enable in CI: `tsc --noEmit` (and/or Vite build runs type-check).

3. **CI**: Add an explicit type-check step if not already covered by build, e.g. `pnpm exec tsc --noEmit`.

4. **Documentation**: Update README with “TypeScript” and any new scripts (e.g. `tsx` for backend). Note Node version if required for ESM/TS.

5. **Lock file and deploy**: Run `pnpm install` and ensure production deploy (e.g. Fly) uses the same start command and that `tsx` (or compiled output) is available in the image. If using `tsx`, add it as a dependency (not dev) for production, or compile backend to JS and run with `node`.

**Status:** Phase 5 partial. Root `tsconfig.json`: `allowJs` set to `false` (include only `**/*.ts`/`**/*.tsx`). README updated: TypeScript note, `vite.config.ts`, `pnpm run typecheck`, `pnpm test`, `pnpm run test:e2e`, `pnpm run test:poster-flow`. CI type-check: use existing `pnpm run typecheck` in CI. Removed dead `public/countrySelector.js`. Playwright `reuseExistingServer: true` so E2E can reuse an already-running dev server (e.g. run `pnpm run test:e2e` while `pnpm run dev` is up).

---

## 9. File and script change summary

| Item | Before | After |
|------|--------|--------|
| Backend entry | `node server.js` | `tsx server.ts` or `node dist/server.js` |
| Unit tests | `node tests/*.test.js` | `tsx tests/*.test.ts` or Vitest |
| Frontend entry | `public/src/main.jsx` | `public/src/main.tsx` |
| HTML script | `src/main.jsx` | `src/main.tsx` |
| Configs | `vite.config.js`, `playwright.config.js` | `vite.config.ts`, `playwright.config.ts` |
| E2E spec | `e2e/app.spec.js` | `e2e/app.spec.ts` |
| Optional test | (standalone) | `pnpm run test:poster-flow` (tsx tests/testPosterFlow.test.ts) |
| package.json `main` | `server.js` | `server.ts` (or keep for compatibility; start script is what matters) |

---

## 10. Risk mitigation

- **Import paths**: With ESM, watch for extension handling (.ts vs .js in imports after compile). Using tsx avoids emit and keeps imports simple.
- **Third-party types**: Some packages may lack types; use `@types/...` or declare a minimal `declare module "..."` in `*.d.ts`.
- **Environment and globals**: Type `process.env`, `window.__POSTHOG_KEY__`, etc. in a single `env.d.ts` or `global.d.ts` to avoid scattered assertions.
- **Redis/PostHog**: Typing return shapes from Redis (e.g. `getCacheValue`) and PostHog calls will catch serialization/usage bugs early.

---

## 11. Suggested branch and PR strategy

- Create a branch `ts-migration` and do Phase 0 there; open a PR and get CI green.
- Proceed phase by phase (shared types → backend → frontend → tests → cleanup), pushing after each phase with CI passing.
- Prefer many small PRs (e.g. “Phase 2: helpers and lib”) over one large PR, so review and rollback are easier.
- Keep `master` deployable at every step; optionally run E2E on the branch before merging.

---

## 12. Quick reference: dependency and script updates

**Install (Phase 0):**
```bash
pnpm add -D typescript @types/node @types/express @types/react @types/react-dom
pnpm add -D tsx
```

**Example script updates (after migration):**
```json
"start": "tsx server.ts",
"be:dev": "nodemon --exec tsx server.ts",
"test": "tsx tests/filterLogic.test.ts && tsx tests/stateTileManagement.test.ts && ...",
"build:providers": "tsx scripts/buildCanonicalProviders.ts",
```

**Optional:** Add type-check script and run in CI:
```json
"typecheck": "tsc --noEmit"
```

This plan keeps behavior unchanged while moving the codebase to TypeScript incrementally and keeping CI and production deployment green throughout.
