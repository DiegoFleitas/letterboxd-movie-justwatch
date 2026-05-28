# Fly.io Cost Reduction — Execution Plan

> **For agentic workers:** Use superpowers:executing-plans. Tasks are sequential — one depends on the previous.

**Goal:** Get monthly Fly.io billing back under $5 (to $0) by removing Upstash Redis and shrinking the VM to 256mb.

**Rationale:** Free tier covers 3 × shared-cpu-1x@256mb ($6) + 3GB volumes. Currently 100% of machine allowance is consumed. After changes, `movie-justwatch` fits entirely within the free allowance.

**Current allowances:** Machine $6.00/$6.00 (100%), Volume $0.13/$0.50 (28%), Bandwidth (Asia) $0.13/$1.20 (11%) — all else 0%.

**Tech Stack:** flyctl, bun, Fly.io dashboard

---

## Pre-flight check

Verify the app works without Redis (already proven in CI):

```bash
grep 'DISABLE_REDIS' .github/workflows/ci.yml
# Expect: DISABLE_REDIS: "1"
```

All `getCacheValue`/`setCacheValue` calls return `null` when Redis is disabled — no code changes needed.

---

## Task 1: Remove Upstash Redis from production

**Files:**

- Run: `fly secrets set DISABLE_REDIS=1`
- Run: `fly secrets unset FLYIO_REDIS_URL`
- Run: `fly redis destroy movie-justwatch-redis -y`
- Modify: `.env.example` (update Redis comment)
- Modify: `AGENTS.md` (cost reduction record + Redis note)

### Step 1: Set DISABLE_REDIS and remove Redis URL

```bash
fly secrets set DISABLE_REDIS=1
fly secrets unset FLYIO_REDIS_URL
```

The app calls `isRedisDisabled()` which checks `DISABLE_REDIS === "1"`. Every Redis function (`getCacheValue`, `setCacheValue`, etc.) handles `client === null` gracefully. The `/redis-healthcheck` endpoint returns `"OK (Redis disabled)"` with 200 status.

### Step 2: Destroy the Upstash Redis instance

```bash
fly redis destroy movie-justwatch-redis -y
```

Saves ~$5/mo (Cost Explorer showed $9.69/35d for Redis). Local `docker-compose.yml` Redis is unaffected.

### Step 3: Update .env.example

```diff
- # --- Redis ---
- FLYIO_REDIS_URL=redis://localhost:6379
+ # --- Redis (local dev only; production uses DISABLE_REDIS=1) ---
+ FLYIO_REDIS_URL=redis://localhost:6379
```

### Step 4: Update AGENTS.md (partial — final text in Task 4)

---

## Task 2: Shrink VM to 256mb

**Files:**

- Modify: `fly.toml` (line 20)

### Step 1: Edit fly.toml

```diff
-   memory = '1gb'
+   memory = '256mb'
```

The free tier covers 3 shared-cpu-1x@256mb machines. Both `movie-justwatch` (now 256mb) and `bold-feather-1773` (256mb base + 768mb extra RAM) fit within the 3-slot allowance. The `auto_stop_machines = 'stop'` / `min_machines_running = 0` config ensures it auto-stops when idle.

### Step 2: Deploy

```bash
fly deploy
```

Verify:

```bash
fly machine list -a movie-justwatch --json | jq '.[] | {id, state, ram: .config.guest.memory_mb}'
# Expect: ram: 256
```

---

## Task 3: Cost breakdown

### Before (current: ~$12.26/mo billable, $18.53 raw)

| Item                    | Raw         | After allowances                          | Billable       |
| ----------------------- | ----------- | ----------------------------------------- | -------------- |
| movie-justwatch @ 1gb   | ~$4.26      | Machine allowance (-$6), leftover RAM (-) | ~$2.57         |
| bold-feather-1773 @ 1gb | ~$4.26      |                                           | included above |
| Upstash Redis           | ~$5.00      | —                                         | $5.00          |
| Volumes                 | ~$0.29      | Volume allowance (-$0.29)                 | $0.00          |
| Bandwidth               | ~$0.01      | Bandwidth allowance                       | $0.00          |
| **Total**               | **~$18.53** | **(-$6.29 allowances)**                   | **~$12.26**    |

### After (projected: ~$0.13/mo billable, ~$8.84 raw)

| Item                           | Raw        | After allowances                      | Billable   |
| ------------------------------ | ---------- | ------------------------------------- | ---------- |
| movie-justwatch @ 256mb        | ~$1.83     | Machine allowance (-$1.83)            | **$0.00**  |
| bold-feather-1773 @ 1gb        | ~$4.26     | Machine allowance (-$4.17) + leftover | **~$0.09** |
| Upstash Redis                  | —          | —                                     | **$0.00**  |
| Volumes                        | ~$0.29     | Volume allowance (-$0.29)             | **$0.00**  |
| Bandwidth                      | ~$0.01     | Bandwidth allowance                   | **$0.00**  |
| Additional RAM (Jackett 768mb) | ~$0.47     | —                                     | **$0.47**  |
| **Total**                      | **~$8.84** | **(-$8.71 allowances)**               | **~$0.13** |

The free machine allowance ($6) covers the base 256mb of both apps. `movie-justwatch` at 256mb costs $0 to run. `bold-feather-1773` at 1gb costs only the extra RAM (768mb above the free 256mb) ≈ $0.47/mo. Net billable ≈ **$0.13/mo** — under $5 → **$0 billing**.

---

## Task 4: Documentation

### AGENTS.md

Add under a new "Cost history" section:

```markdown
## 2026-05-28 Cost reduction

- Removed Upstash Redis (`DISABLE_REDIS=1`, instance destroyed) — saved ~$5/mo
- Shrunk `movie-justwatch` VM from 1gb to 256mb — saved ~$2/mo
- Net effect: raw spend ~$18.53 → ~$8.84, billable ~$12.26 → ~$0.13 → $0
- Jackett app (`bold-feather-1773`) kept at 1gb, fits within free allowance
- Production runs with `DISABLE_REDIS=1` (in-process cache). Redis is only used in local dev / Docker Compose.
```

### README.md or project wiki

```markdown
> **Production Redis**: This app does not require Redis in production.
> Set `DISABLE_REDIS=1` and omit `FLYIO_REDIS_URL`. The app falls back to
> an in-process cache (or the in-memory TTL cache if the codebase
> optimization plan is also applied). Redis is only needed for local
> development (see `docker-compose.yml`).
```

---

## Files changed summary

| File           | Change                                        |
| -------------- | --------------------------------------------- |
| `fly.toml:20`  | `memory = '1gb'` → `'256mb'`                  |
| `.env.example` | Comment update for Redis                      |
| `AGENTS.md`    | Cost reduction record + production Redis note |
| (none — code)  | No source code changes needed                 |

## Rollback

```bash
fly secrets unset DISABLE_REDIS
fly secrets set FLYIO_REDIS_URL=redis://<upstash-url>:6379
# Re-create Redis if destroyed:
fly redis create --name movie-justwatch-redis --region gru
fly deploy
```
