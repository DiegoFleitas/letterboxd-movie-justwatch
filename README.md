# Letterboxd Movie JustWatch

Scan any public Letterboxd watchlist and see where each film is streaming in your country. Uses JustWatch data without recommendation clutter, plus an optional alternative (Jackett‑backed) search.

## What it does

- **Watchlists**: Fetch a public Letterboxd watchlist or custom list and show streaming availability per film.
- **Per‑country availability**: Pick a country and see which services carry each title there.
- **Alternative search**: Fallback Jackett search for harder‑to‑find titles.

## Tech stack

- **Frontend**: React + Vite
- **Backend**: Node + Express (TypeScript, `tsx`)
- **Tooling**: Vitest, Playwright, ESLint, Prettier

## Quick start (local)

1. Install dependencies:
   - `pnpm install`
2. Create your env file:
   - `cp .env.example .env`
   - Set at least `OMDB_API_KEY` and `FLYIO_REDIS_URL` (see below).
3. Start dev servers (frontend + backend):
   - `pnpm run dev`
4. Open `http://localhost:5173` in your browser.

### Common commands

- **Dev (full stack)**: `pnpm run dev`
- **Tests (unit)**: `pnpm test`
- **Tests (e2e)**: `pnpm run test:e2e`
- **Typecheck**: `pnpm run typecheck`
- **Lint / format**: `pnpm run lint`, `pnpm run format:check`

## Configuration (env)

See `.env.example` for the full list. Key variables:

- **`FLYIO_REDIS_URL`** (required): Redis URL, e.g. `redis://localhost:6379`.
- **`OMDB_API_KEY`** (required for posters): OMDb API key to fetch poster URLs.
- **`CACHE_TTL`** (optional): Base TTL for cached results (overridden per controller).
- **`POSTHOG_KEY` / `POSTHOG_HOST`** (optional): Enable PostHog analytics.
- **`JACKETT_API_KEY` / `JACKETT_API_ENDPOINT`** (optional): Enable alternative (Jackett) search.

Redis snapshot/export details live in `redis/README.md`.

## Deploying to Fly.io (short version)

1. Make sure `app` name in `fly.toml` and `package.json` is what you want.
2. Ensure `.env` is set locally; then set production secrets with `flyctl secrets set ...`.
3. Build and deploy:
   - `pnpm run fly:deploy`

For Redis provisioning and more details, see:

- `redis/README.md`
- Fly.io Redis docs (`https://fly.io/docs/reference/redis/`)

## Contributing & license

- PRs and issues are welcome. Before pushing, run: `pnpm run lint`, `pnpm run typecheck`, `pnpm test`.
- Licensed under **ISC** (see `package.json`).

## JustWatch API disclaimer (summary)

- This is **not** the official JustWatch API.
- The data and API are owned and maintained by JustWatch; **commercial use is prohibited** (no consumer services, business intelligence, monetization, etc.).
- Non‑commercial / personal use is allowed, but keep traffic reasonable to avoid overloading the API.
- The API may change or be disabled at any time; it is provided **without warranty** and you use it at your own risk.
- For official access and commercial use, see JustWatch’s data offering and contact them directly.

# Letterboxd Movie JustWatch

Scan any public Letterboxd watchlist and see which services stream each film in your chosen country. Uses JustWatch data without the recommendation clutter; supports alternative search and country selection.

## Features

- Scan any **public Letterboxd watchlist** and resolve each film against JustWatch
- Show **streaming availability by country**, based on your selected region
- Support for **alternative search** when the primary JustWatch lookup fails
- Frontend built with **React + Vite**, backend with **Node + Express**
- Caching of JustWatch responses via **Redis** for faster repeated lookups

## Tech stack

**TypeScript** across the stack:

- **Backend**: Node, Express, `tsx`
- **Frontend**: React, Vite
- **Tooling**: Vitest, Playwright, ESLint, Prettier

Backend and tests run with `tsx`; type-check with `pnpm run typecheck`. Unit tests: `pnpm test`; E2E tests: `pnpm run test:e2e`. Optional integration test (requires server): `pnpm run test:poster-flow`.

## Usage

Once the app is running locally or deployed:

- Open the app in your browser (by default: `http://localhost:5173` in development, or your Fly app URL in production).
- **To scan a Letterboxd watchlist:**
  - Paste a public Letterboxd watchlist or custom list URL into the list form.
  - Choose your country from the country selector.
  - Submit the form to fetch and display tiles for each film with streaming providers.
- **To search an individual movie:**
  - Enter movie title (and optionally year) in the movie form.
  - Submit to see where it’s streaming in your selected country.
- **To run an alternative search:**
  - Use the “torrent / alternative search” action from the UI; this calls the Jackett-backed alternative search endpoint and returns a best‑guess result.

The UI will show provider icons and posters as they are resolved from the backend and cached in Redis.

## Prerequisites

- **Node.js** (recent LTS recommended)
- **pnpm** (see `package.json` for the exact version used)
- **Redis**:
  - For local development, you can run the Docker image described in `redis/README.md`, or
  - Use an Upstash Redis instance (see the Redis section below)

You will also need to copy environment variables from `.env.example` into a local `.env` file.

## Configuration

Key environment variables (see `.env.example` for the full list):

| Name                    | Required | Default                    | Description                                                                 |
| ----------------------- | -------- | -------------------------- | --------------------------------------------------------------------------- |
| `PORT`                  | No       | `3000`                     | Port for the Express server.                                               |
| `FLYIO_REDIS_URL`      | No       | `redis://localhost:6379`   | Redis connection URL used by the app and Redis helpers.                    |
| `FLY_APP_NAME`         | No       | `"app"`                    | App name used for Redis key namespaces and categories.                     |
| `CACHE_TTL`            | No       | Varies by controller       | Default TTL (seconds) for cached results (list/movie/alt search).         |
| `OMDB_API_KEY`         | Yes\*    | —                          | API key for OMDb, used to fetch poster images.                             |
| `POSTHOG_KEY`          | No       | —                          | PostHog project API key (enables analytics and error tracking).           |
| `POSTHOG_HOST`         | No       | `https://us.i.posthog.com` | PostHog host; override for EU or self‑hosted instances.                    |
| `JACKETT_API_KEY`      | No       | —                          | Jackett API key for the alternative search endpoint.                       |
| `JACKETT_API_ENDPOINT` | No       | —                          | Base URL for Jackett (e.g. `http://jackett:9117`).                         |
| `REDIS_SNAPSHOT_PATH`  | No       | `data/redis-snapshot.json` | Path for Redis snapshot export/seed scripts.                               |
| `SEED_REDIS_URL`       | No       | `FLYIO_REDIS_URL` / local  | Redis URL used by the seed script; falls back to main Redis URL or local. |

Variables marked **Yes\*** are required only for the related features (e.g. movie posters or analytics).

## Getting started (local development)

1. Install dependencies:
   - `pnpm install`
2. Create your environment file:
   - Copy `.env.example` to `.env`
   - Fill in required values (API keys, Redis URL, PostHog keys, etc.)
3. Ensure Redis is running and reachable by the app (see `redis/README.md` for local setup details).
4. Start the full stack (frontend + backend) in development mode:
   - `pnpm run dev`

The frontend is served with Vite (Hot Module Replacement enabled) and proxies `/api` requests to the Express backend as configured in `vite.config.ts`.

## Useful scripts

All scripts are run with `pnpm <script>`:

- **Development**
  - `dev`: run frontend (`vite`) and backend (`server.ts` via `nodemon` + `tsx`) together
  - `fe:dev`: run only the Vite dev server
  - `be:dev`: run only the backend dev server

- **Build & production**
  - `build`: production build of the frontend
  - `start`: run the backend (`server.ts`)
  - `fe:serve`: serve the built frontend via `vite preview`

- **Type checking & linting**
  - `typecheck`: type-check backend and frontend
  - `lint`: run ESLint across the project
  - `lint:fix`: run ESLint with `--fix`
  - `format:check`: check formatting with Prettier
  - `format:write`: apply formatting with Prettier

- **Testing**
  - `test`: run the unit test suite
  - `test:e2e`: run Playwright end‑to‑end tests
  - `test:e2e:ui`: run E2E tests with the Playwright UI
  - `test:poster-flow`: optional integration test that exercises the poster/lookup flow (requires server running)

- **Redis utilities**
  - `build:providers`: generate canonical provider data
  - `build:providers:dry-run`: dry run provider generation
  - `export-redis`: export a Redis snapshot
  - `seed-redis`: seed Redis from a snapshot

For more Redis-specific details, see `redis/README.md`.

## Fly.io deployment

The app is designed to run on Fly.io (currently on the free tier).

1. Replace `"name"` and `"app"` strings with your desired app name in both `package.json` and `fly.toml`.
2. Install dependencies:
   - `pnpm install`
3. Prepare environment:
   - Copy `.env.example` to `.env`
   - Fill in all required values
4. Launch the Fly app:
   - `flyctl launch`
   - When prompted for a builder, select the built‑in Node.js builder.
5. Deploy:
   - `pnpm run fly:deploy`
   - For subsequent deployments, `pnpm run fly:deploy` is all you need.

### Managing the Fly app

- **Stop / start**
  - Stop: `pnpm run fly:stop`
  - Start: `pnpm run fly:start`

- **Read app secrets**
  - `pnpm run fly:ssh`
  - Inside the shell, run `env`
  - Exit with `exit`

- **Set app secrets**
  - You can add secrets to `.env` for local development.
  - To set Fly-managed secrets (which take precedence over `.env`):
    - `flyctl secrets set SECRET="myvalue" -a <app-name>`

- **Server logs**
  - `pnpm run fly:logs`

### Redis on Fly / Upstash

You can provision an Upstash Redis instance through Fly:

1. Create Redis:
   - `flyctl redis create`
2. List and locate your Redis instance:
   - `flyctl redis list`
3. Get connection details:
   - `flyctl redis status <redis-name>`
   - Copy the **Private URL** and configure the corresponding environment variable in `.env`.

See the Redis guide for more context:

- https://fly.io/blog/shipping-logs/
- https://fly.io/docs/reference/redis/

## Troubleshooting

- Ensure Redis is running and accessible (check connection URL and credentials).
- Verify `.env` contains all required variables and matches the deployment environment.
- Check `redis/README.md` for local Redis setup and common issues.
- Use `pnpm run fly:logs` to inspect logs when running on Fly.io.

## Contributing

Contributions and bug reports are welcome:

- Open an issue describing the bug/feature.
- For code changes, please:
  - Run `pnpm run lint` and `pnpm run typecheck`.
  - Run `pnpm test` (and `pnpm run test:e2e` if you’ve touched user‑visible flows).
  - Include a brief description of the change and any relevant screenshots for UI changes.

## License

This project is licensed under the **ISC License** (see the `license` field in `package.json`).

## Disclaimer

**This is not the official JustWatch API.**

The work of many developers went and is still going into the development and maintenance of the data and the API. The main business of JustWatch is to operate a streaming guide with apps for iOS, Android and TV that offers the data for business intelligence and marketing. Therefore it is prohibited to use the API for commercial purposes, meaning all purposes intended for, or directed towards, commercial advantage or monetization by an individual or organization (consumer service, data science, business intelligence etc.). The API may be used for non-commercial purposes such as private projects, but please be respectful with your API calls to prevent an overload on the API.

JustWatch does not warrant that the API is free of inaccuracies, errors, bugs, malicious code or interruptions or that it is reliable, flawless, complete or otherwise valid. JustWatch does not warrant that the API will meet your requirements, will be available without interruption, or that the results from its use will be accurate or reliable, the quality of the products, services, information or other materials received through the API meets your expectations, and errors regarding the API are corrected. Use of the API is at your sole discretion and risk. You are solely responsible for any damages resulting from your use of the API, including damage to its system or loss of data. JustWatch can disable and change the API at any time without notice and without giving any reason. JustWatch excludes any liability to the extent permitted for direct, indirect or incidental damages, consequential damages, lost profits, quantifiable pecuniary losses arising out of or in connection with the use of the API.
Incorrect or prohibited use of the API, for example for commercial use, may result in a claim for damages by JustWatch.

If you would like to work with JustWatch and use the official Data API take a look at JustWatch Media and contact us at data-partner@justwatch.com. Currently, JustWatch can only work with bigger partners and clients. JustWatch is also hiring: https://www.justwatch.com/us/talent and has some interesting open source projects on GitHub.
