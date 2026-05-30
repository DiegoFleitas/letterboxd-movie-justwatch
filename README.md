# Letterboxd Movie JustWatch

<div align="center">

<img
  src="docs/images/github-banner.png"
  alt="Letterboxd watchlists mapped to streaming availability"
  width="800"
  style="max-width: min(920px, 100%); height: auto; border-radius: 12px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22);"
/>

<br />

[![Deploy](https://img.shields.io/github/actions/workflow/status/DiegoFleitas/letterboxd-movie-justwatch/fly-deploy.yml?branch=master&label=Deploy&logo=flydotio)](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/actions/workflows/fly-deploy.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/DiegoFleitas/letterboxd-movie-justwatch/ci.yml?branch=master&label=CI&logo=github)](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DiegoFleitas_letterboxd-movie-justwatch&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DiegoFleitas_letterboxd-movie-justwatch)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=DiegoFleitas_letterboxd-movie-justwatch&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=DiegoFleitas_letterboxd-movie-justwatch)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/DiegoFleitas/letterboxd-movie-justwatch)

**Paste a public Letterboxd list, pick a country, see where each film streams.**

</div>

---

Pulls titles from any Letterboxd watchlist or custom list and maps them to streaming availability via JustWatch data—no recommendation layer, just the info. Optional Jackett integration for titles that are hard to match.

**Stack:** React 19 + Vite frontend, Bun + Fastify backend, TypeScript throughout. In-process cache in production; Redis available for local dev via Docker Compose.

## Quick start

Requires **[Bun](https://bun.sh)** (version pinned in `package.json`).

```bash
bun install
cp .env.example .env
bun run dev
```

Open `http://localhost:5173`. Set `OMDB_API_KEY` in `.env` for posters; `APP_SECRET_KEY` (≥ 32 chars) is required in production.

### Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:3000`. Pass secrets via `.env` or `docker-compose.override.yml`.

## Local Redis dev

Production runs with `DISABLE_REDIS=1`. Redis is only used locally.

```bash
bun run redis:reset   # validate + seed (exports first if snapshot is missing)
bun run export-redis  # export running Redis → redis/data/redis-snapshot.json
bun run seed-redis    # restore snapshot → local Redis
```

Scripts reject non-local hosts by default; set `ALLOW_NON_LOCAL_REDIS=1` to override.

## Deploy

CI runs on push to `master`. On success, GitHub Actions builds the app, uploads Sentry sourcemaps, and deploys to Fly.io. See [`.github/workflows/fly-deploy.yml`](.github/workflows/fly-deploy.yml).

## Contributing

```bash
bun run lint && bun run typecheck && bun run knip && bun run test
```

Full operational detail lives in [`AGENTS.md`](AGENTS.md). E2E test notes in [`tests/e2e/README.md`](tests/e2e/README.md).

**License:** ISC

## JustWatch data notice

Uses unofficial JustWatch endpoints for non-commercial personal use only. Endpoints may change without notice.
