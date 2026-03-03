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
2. `cp .env.example .env` and set at least `OMDB_API_KEY` and `FLYIO_REDIS_URL`.
3. `pnpm run dev`
4. Open `http://localhost:5173`

### Key commands

- **Dev**: `pnpm run dev`
- **Tests**: `pnpm test`, `pnpm run test:e2e`
- **Typecheck**: `pnpm run typecheck`
- **Lint/format**: `pnpm run lint`, `pnpm run format:check`
- **Deploy (Fly.io)**: `pnpm run fly:deploy`

### Configuration (env)

See `.env.example` for full details. Common variables:

- `FLYIO_REDIS_URL` – Redis URL (e.g. `redis://localhost:6379`)
- `OMDB_API_KEY` – required for poster lookups
- `POSTHOG_KEY` / `POSTHOG_HOST` – optional analytics
- `JACKETT_API_KEY` / `JACKETT_API_ENDPOINT` – optional alternative search

Redis and snapshot/export details live in `redis/README.md`.

### Contributing & license

- Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm test` before opening a PR.
- Licensed under **ISC** (see `package.json`).

### JustWatch API note

This project uses **unofficial** JustWatch endpoints for non‑commercial, personal use only. For commercial use or official data access, contact JustWatch and use their official offerings; the API may change or be disabled at any time and is used at your own risk.
