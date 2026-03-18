## Letterboxd Movie JustWatch

Scan any public Letterboxd watchlist and see where each film is streaming in your country. Uses JustWatch data without recommendation clutter, plus an optional alternative (Jackett‑backed) search.

### What it does

- **Watchlists**: Fetch a public Letterboxd watchlist or custom list and show streaming availability per film.
- **Per‑country availability**: Pick a country and see which services carry each title there.
- **Alternative search**: Fallback Jackett search for harder‑to‑find titles.

### Tech stack

- React + Vite
- Node + Express (TypeScript, `tsx`)
- Vitest, Playwright, ESLint, Prettier

### Quick start

1. `pnpm install`
2. `cp .env.example .env` and set at least `FLYIO_REDIS_URL`, `OMDB_API_KEY` (posters), and for production **`APP_SECRET_KEY`** (≥32 characters for sessions).
3. `pnpm run dev`
4. Open `http://localhost:5173`

### Docker Compose

Run the app and Redis with Docker Compose:

```bash
docker compose up --build
```

Then open `http://localhost:3000`. To pass API keys (e.g. `OMDB_API_KEY`, `APP_SECRET_KEY`), create a `.env` file in the project root or set them in a `docker-compose.override.yml`; Compose will load `.env` automatically.

### Key commands

- **Dev**: `pnpm run dev`
- **Tests**: `pnpm test` (Vitest unit/integration), `pnpm run test:e2e` (Playwright; run `pnpm run dev` first so Fastify is up—see [`e2e/README.md`](e2e/README.md)). Manual poster checks: `pnpm run test:poster-flow` with backend on port 3000.
- **Typecheck**: `pnpm run typecheck`
- **Lint/format**: `pnpm run lint`, `pnpm run format:check`
- **Deploy (Fly.io)**: `pnpm run fly:deploy`

### Configuration (env)

See `.env.example` for full details. Common variables:

- `APP_SECRET_KEY` – **required in production**; must be **at least 32 characters** (Fastify session). Local `pnpm dev` uses a built-in dev default if unset.
- `FLYIO_REDIS_URL` – Redis URL (e.g. `redis://localhost:6379`). **Do not set** `DISABLE_REDIS` locally if you want caching against real Redis.
- `DISABLE_REDIS` – set to `1` or `true` to skip Redis entirely (used in CI; omit locally for normal dev).
- `OMDB_API_KEY` – poster lookups
- `MOVIE_DB_API_KEY` – TMDb / search; optional locally; enables the extra integration test in CI if set
- `POSTHOG_KEY` / `POSTHOG_HOST` – optional analytics
- `JACKETT_API_KEY` / `JACKETT_API_ENDPOINT` – optional alternative search
- `CACHE_TTL` – optional override for cache durations (seconds)

Redis and snapshot/export details live in `redis/README.md`.

### Contributing & license

- Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm test` (Vitest) before opening a PR. See [`tests/README.md`](tests/README.md) for conventions.
- Licensed under **ISC** (see `package.json`).

### JustWatch API note

This project uses **unofficial** JustWatch endpoints for non‑commercial, personal use only. For commercial use or official data access, contact JustWatch and use their official offerings; the API may change or be disabled at any time and is used at your own risk.
