# E2E (Playwright)

## Two kinds of tests

| File                        | What it validates                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`app.spec.ts`**           | UI flows with **`page.route()`** mocking `/api/*`. Requests never reach Fastify. Fast and deterministic; does **not** prove the backend is running. |
| **`backend-smoke.spec.ts`** | Real HTTP calls to the **Fastify** process (`/healthcheck`, `/redis-healthcheck`). Proves the API is up (CI runs `pnpm run dev` + build first).     |

## API URL for smoke tests

- Default: **`http://127.0.0.1:3000`** (same as `PORT` default in `server-fastify.ts`).
- Override: set **`E2E_API_BASE_URL`** (no trailing slash), e.g. `http://127.0.0.1:3001`.

Playwright’s `webServer` only waits on **5173** (Vite). The backend must be listening on the smoke base URL—locally run `pnpm run dev` (fe + be) before `pnpm run test:e2e`.
