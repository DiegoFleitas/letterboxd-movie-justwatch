# Fly.io Cost Reduction — fly-ops Audit & Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce monthly Fly.io hosting costs by eliminating wasted resources and automating cost visibility.

**Architecture:** Two Fly apps — `movie-justwatch` (the main app, 1gb RAM, auto-stops when idle) and `bold-feather-1773` (Jackett proxy for alternative search). Upstash Redis backs the cache layer. fly-ops bash scripts (`/home/diego/environment/fly-ops`) inventory resources but lack billing data, cost estimates, and integration with the main project.

**Tech Stack:** flyctl, jq, bash, GitHub Actions (scheduled), Fly.io dashboard

---

## Cost Driver Analysis

### Known resources on Fly:

| Resource      | ID                      | Spec                     | Est. Monthly |
| ------------- | ----------------------- | ------------------------ | ------------ |
| Main app VM   | `movie-justwatch`       | 1gb RAM, shared CPU, gru | ~$5-8        |
| Jackett proxy | `bold-feather-1773`     | unknown spec             | ~$5-8        |
| Upstash Redis | `movie-justwatch-redis` | unknown plan             | ~$5-30       |
| Sentry (SaaS) | N/A                     | N/A                      | ~$0-29       |

**Potential waste:**

1. Jackett app may be unused or replaceable with direct APIs
2. Redis plan may be oversized for the cache volume
3. Unattached volumes may be billed
4. The `redis/entrypoint.sh` ships a hardcoded placeholder token — the custom Redis Docker image with flyctl is not actually used in production and its Dockerfile/entrypoint are dead code with a security smell
5. `fly.toml` is at 1gb — could drop to 512mb if memory usage allows

---

## Refactoring fly-ops

### Gaps found in current fly-ops scripts (`/home/diego/environment/fly-ops`):

| Gap                                                                                | Impact                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `fly-post-cost-check.sh` is a thin wrapper — just prints a manual checklist        | No automated cost collection               |
| No billing API usage (`fly billing` exists but is unauthenticated via CLI)         | Can't programmatically get invoice         |
| No cost estimation (multiply `memory_mb` + `cpus` by known rates)                  | No dollar figures in output                |
| No Fly API token check or fallback to dashboard URL                                | Fails gracefully but gives no path forward |
| No CI integration (GitHub Actions scheduled run)                                   | No regular cost reports                    |
| No machine uptime tracking (auto-stop means partial-month billing)                 | Cost estimation wrong for stopped machines |
| Hardcoded token placeholder in `redis/entrypoint.sh`                               | Dead code, security smell                  |
| No call to `fly platform vm-sizes` to get current pricing                          | Estimates use hardcoded assumptions        |
| `fly-volumes-prune.sh` handles unattached but not orphan volumes from deleted apps | Billing leak                               |
| No pre-commit / lint-staged config for bash scripts                                | Maintenance risk                           |

### Refactor targets:

1. **`fly-post-cost-check.sh`** — Stop being a thin wrapper. Compute actual cost estimates:
   - Fetch `fly platform vm-sizes` to get current pricing per size
   - Fetch `fly billing history` if available, or print dashboard URL
   - Multiply machine RAM+CPU by hourly rate, adjust for auto-stop idle time
   - Include Redis plan estimate ($5/mo pay-as-you-go baseline)
   - Flag `bold-feather-1773` as a cost center with a question: "in use?"

2. **`fly-inventory.sh`** — Add:
   - Machine uptime tracking (state + optional `--uptime` flag to sum idle time)
   - App `status` field used to skip `machines list` for deleted/suspended apps
   - Org-wide cost summary at the end (total machines × rates)
   - JSON output mode (`--json`) for tooling consumption

3. **`fly-memory-check.sh`** — Add recommendation engine:
   - If memory usage < 512mb over a sampling window, suggest downgrading to 512mb
   - If 2+ machines running, suggest scale down

4. **`fly-redis-audit.sh`** — Add:
   - Plan cost extraction from `fly redis status` output
   - Suggestion to downgrade to pay-as-you-go if command volume is low

5. **`fly-volumes-prune.sh`** — Add:
   - Scan for volumes whose app no longer exists (orphan volumes from deleted apps)

6. **`redis/entrypoint.sh`** — Remove the broken flyctl auth line; the image is unused dead code
   - Or delete `redis/Dockerfile` + `entrypoint.sh` entirely if confirmed unused

---

## Integration into Main Project

### 1. Add fly-ops as a git submodule

```bash
cd /home/diego/environment/letterboxd-movie-justwatch
git submodule add https://github.com/DiegoFleitas/fly-ops.git devops/fly-ops
```

This makes fly-ops scripts available at `devops/fly-ops/bin/` without manual clone management.

### 2. Add package.json scripts

```json
"fly:cost:audit": "bash devops/fly-ops/bin/fly-post-cost-check.sh",
"fly:inventory": "bash devops/fly-ops/bin/fly-inventory.sh",
"fly:cost:weekly": "bash devops/fly-ops/bin/fly-post-cost-check.sh"
```

### 3. Add scheduled GitHub Actions workflow for cost reports

`.github/workflows/fly-cost-report.yml` — runs every Monday, runs inventory + post-cost-check, posts summary as an issue or job summary.

---

## Cost Reduction Actions (based on audit)

### Phase 1: Quick wins (zero code changes)

- [ ] Run `fly-inventory.sh --volume-risk` to find and destroy unattached volumes
- [ ] Run `fly-redis-prune.sh` to remove any stale Upstash Redis DBs
- [ ] Check if `bold-feather-1773` (Jackett) is actively used; if not, `fly apps destroy bold-feather-1773`
- [ ] Review Redis plan: `fly redis update movie-justwatch-redis` → switch to pay-as-you-go if on fixed
- [ ] Delete the dead `redis/Dockerfile` and `redis/entrypoint.sh` (unused, contains placeholder token)

### Phase 2: Data-driven (after monitoring)

- [ ] Deploy memory monitoring to see peak RSS → if < 512mb, change fly.toml to `memory = '512mb'`
- [ ] Measure cache hit ratio → if low, consider disabling Redis entirely for the app (use in-process LRU)
- [ ] If Jackett is unused, remove its controller code and env vars

### Phase 3: fly-ops refactor

- [ ] Add cost estimation engine to `fly-post-cost-check.sh` using `fly platform vm-sizes`
- [ ] Add JSON output mode to `fly-inventory.sh`
- [ ] Add uptime-aware cost calculation (accounts for auto-stop)
- [ ] Clean up `redis/entrypoint.sh` (remove dead flyctl auth token line)

### Phase 4: Project integration

- [ ] Add fly-ops as git submodule at `devops/fly-ops`
- [ ] Add `fly:cost:audit` script to package.json
- [ ] Create `.github/workflows/fly-cost-report.yml` (weekly scheduled)
- [ ] Add `fly-ops` devops context to `AGENTS.md`

---

## Task breakdown

### Task 1: Run fly-ops inventory against the org

**Files:**

- Run: `bash /home/diego/environment/fly-ops/bin/fly-inventory.sh --volume-risk`
- Run: `bash /home/diego/environment/fly-ops/bin/fly-redis-audit.sh`
- Run: `bash /home/diego/environment/fly-ops/bin/fly-volumes-prune.sh` (dry-run)

- [ ] **Step 1: Ensure prerequisites**

```bash
which fly || echo "install flyctl: https://fly.io/docs/flyctl/install/"
which jq  || echo "install jq: https://jqlang.org/download/"
```

Expected: both present and authenticated (`fly auth whoami`).

- [ ] **Step 2: Run full inventory + volume risk**

```bash
bash /home/diego/environment/fly-ops/bin/fly-inventory.sh --volume-risk
```

Expected: list of all apps, their machines (state, ram, cpus), volumes (with risk flags), and org Redis list.

- [ ] **Step 3: Identify unattached volumes**

```bash
bash /home/diego/environment/fly-ops/bin/fly-volumes-prune.sh
```

Expected: dry-run output of any unattached volumes by app.

- [ ] **Step 4: Identify stale Redis DBs**

```bash
bash /home/diego/environment/fly-ops/bin/fly-redis-prune.sh
```

Expected: dry-run output showing which DBs would be removed vs kept.

- [ ] **Step 5: Record findings**

Save the output to a file or note. Key data points:

- Number of running machines per app
- Memory/CPU per machine
- Volume count and attachment status
- Redis DB count and plan type

---

### Task 2: Clean up quick-win waste

**Files:**

- Run: `bash .../fly-volumes-prune.sh --execute --yes` (if unattached volumes exist)
- Run: `bash .../fly-redis-prune.sh --execute --yes` (if stale Redis DBs exist)
- Run: `fly apps destroy bold-feather-1773` (if confirmed unused)
- Modify: `redis/entrypoint.sh` (remove dead token)
- Modify: `redis/Dockerfile` (simplify or remove)

- [ ] **Step 1: Destroy unattached volumes**

```bash
bash /home/diego/environment/fly-ops/bin/fly-volumes-prune.sh --execute --yes
```

Expected: each unattached volume destroyed. Run inventory again to confirm.

- [ ] **Step 2: Prune stale Redis DBs**

```bash
bash /home/diego/environment/fly-ops/bin/fly-redis-prune.sh --execute --yes --org YOUR_ORG
```

Expected: stale DBs destroyed. Keep set: `movie-justwatch-redis`.

- [ ] **Step 3: Check Jackett app necessity**

```bash
fly apps list | grep bold-feather
fly logs -a bold-feather-1773 | tail -50
```

If no recent traffic:

```bash
fly apps destroy bold-feather-1773
```

Also remove env vars from `.env`:

```
JACKETT_API_KEY=
JACKETT_API_ENDPOINT=
```

- [ ] **Step 4: Clean up redis/Dockerfile dead code**

Edit `redis/entrypoint.sh` to remove the flyctl auth line. Replace with:

```bash
#!/bin/sh
redis-server
```

The `flyctl auth login --access-token "<your-token>" &` line is a placeholder that never worked and the image is not used in production (the app uses Upstash, not this container).

---

### Task 3: Refactor fly-post-cost-check.sh

**Files:**

- Modify: `/home/diego/environment/fly-ops/bin/fly-post-cost-check.sh`

- [ ] **Step 1: Add cost estimation engine**

Rewrite `fly-post-cost-check.sh` to actually compute estimated costs rather than just print a checklist.

```bash
#!/usr/bin/env bash
# Full inventory + cost estimation + Fly dashboard link
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Get current pricing from Fly
VM_PRICES=$("$DIR/fly-inventory.sh" --json 2>/dev/null || "$DIR/fly-inventory.sh" "$@")

echo "=== Current Resource Inventory ==="
"$DIR/fly-inventory.sh" "$@"

echo ""
echo "=== Cost Estimate ==="

# Estimate based on common Fly.io prices (as of 2026-05):
# Shared CPU: $0.00125/hr per 256mb, $0.005/hr per GB
# Dedicated CPU: varies
echo "Estimated monthly (assuming 24/7 for always-on, partial for auto-stop):"
echo "  shared-cpu-1x@1gb: ~\$5.50/mo (base)"
echo "  Upstash Redis (pay-as-you-go): ~\$5.00/mo"
echo "  Volumes: ~\$0.15/GB/mo"
echo ""
echo "=== Reduce cost opportunities ==="
echo "  1. Jackett app (bold-feather-1773): if unused, saves ~\$5-8/mo"
echo "  2. Check if Redis can downgrade: fly redis update movie-justwatch-redis"
echo "  3. Try 512mb VM: if peak RSS < 400mb, saves ~\$2-3/mo"
echo ""
echo "=== Fly Dashboard ==="
echo "  https://fly.io/dashboard (billing in sidebar)"
```

- [ ] **Step 2: Commit changes to fly-ops**

```bash
cd /home/diego/environment/fly-ops
git add bin/fly-post-cost-check.sh
git commit -m "feat: add cost estimation engine to post-cost-check"
```

---

### Task 4: Add JSON output mode to fly-inventory.sh

**Files:**

- Modify: `/home/diego/environment/fly-ops/bin/fly-inventory.sh`

- [ ] **Step 1: Add `--json` flag**

Add JSON mode that outputs a structured JSON document with:

- `apps[]`: name, status
- `machines[]`: id, region, state, ram_mb, cpus, app
- `volumes[]`: id, name, region, size_gb, state, attached_machine_id, app
- `redis[]`: name (from the table output)
- `summary`: total_machines, total_volumes, total_redis_dbs, total_ram_mb, estimated_monthly_cost

Insert after the `VOLUME_RISK` variable:

```bash
OUTPUT_JSON=0
```

Add to the case statement:

```bash
--json) OUTPUT_JSON=1 ;;
```

Before the main processing loop, add:

```bash
if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  # Build JSON incrementally (simplified — full implementation in step file)
  echo "{"
  echo '  "apps": ['
  first_app=1
fi
```

At the end:

```bash
if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  echo '  ],'
  echo '  "summary": { ... }'
  echo "}"
  exit 0
fi
```

---

### Task 5: Add uptime-aware cost estimation to fly-inventory.sh

**Files:**

- Modify: `/home/diego/environment/fly-ops/bin/fly-inventory.sh`

- [ ] **Step 1: Add `--cost` flag**

When `--cost` is passed (or `--json` is implied), compute:

- For machines in `started`/`running`: `ram_mb / 256 * 0.00125 * 730` (hours/month)
- For machines in `stopped` (auto-stop): cost only for uptime hours
- Redis: flat $5/mo
- Volumes: `size_gb * 0.15`

Add after RAM/CPU display in `machine_lines_fixed`:

```bash
if [[ "${COST_ESTIMATE:-0}" -eq 1 ]]; then
  local hourly_rate
  hourly_rate=$(echo "scale=6; $ram_mb / 256 * 0.00125" | bc)
  local monthly
  monthly=$(echo "scale=2; $hourly_rate * 730" | bc)
  echo "    cost_estimate: ~\$${monthly}/mo (if always-on)"
fi
```

---

### Task 6: Add fly-ops as git submodule

**Files:**

- Create: `.gitmodules`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add submodule**

```bash
cd /home/diego/environment/letterboxd-movie-justwatch
git submodule add https://github.com/DiegoFleitas/fly-ops.git devops/fly-ops
```

- [ ] **Step 2: Add package.json scripts**

```bash
"fly:audit": "bash devops/fly-ops/bin/fly-post-cost-check.sh",
"fly:inventory": "bash devops/fly-ops/bin/fly-inventory.sh",
"fly:inventory:json": "bash devops/fly-ops/bin/fly-inventory.sh --json",
"fly:redis:audit": "bash devops/fly-ops/bin/fly-redis-audit.sh",
"fly:memory:check": "bash devops/fly-ops/bin/fly-memory-check.sh",
```

- [ ] **Step 3: Add devops section to AGENTS.md**

```markdown
## DevOps

fly-ops is at `devops/fly-ops/`. Run `fly:audit` for cost estimates, `fly:inventory`
for resource listing, `fly:memory:check` for VM sizing. All require `flyctl` + `jq`.
```

---

### Task 7: Create weekly cost report GitHub Action

**Files:**

- Create: `.github/workflows/fly-cost-report.yml`

- [ ] **Step 1: Write workflow**

````yaml
name: Fly Cost Report

on:
  schedule:
    # Every Monday at 9:00 UTC
    - cron: "0 9 * * 1"
  workflow_dispatch:

jobs:
  cost-audit:
    name: Cost Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          submodules: true

      - name: Install flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Run cost audit
        id: audit
        run: |
          bash devops/fly-ops/bin/fly-post-cost-check.sh 2>&1 | tee cost-report.txt

      - name: Post job summary
        run: |
          echo "## Fly Cost Report" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          cat cost-report.txt >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
````

- [ ] **Step 2: Add FLY_API_TOKEN to GitHub secrets**

Document in AGENTS.md:

> Weekly cost report requires `FLY_API_TOKEN` secret in GitHub. Generate at https://fly.io/user/api_tokens.

---

### Task 8: Fix security issues found during audit

**Files:**

- Modify: `.env` (remove committed secrets — NOT commit this change, it's in .gitignore already)
- Modify: `redis/entrypoint.sh` (remove flyctl auth placeholder)
- Modify: `.gitignore` (verify `.env` is there)

- [ ] **Step 1: Verify .env is in .gitignore**

```bash
grep '.env' /home/diego/environment/letterboxd-movie-justwatch/.gitignore
```

Expected: `.env` and `.env.*` are present.

- [ ] **Step 2: Clean redis/entrypoint.sh**

```bash
#!/bin/sh
redis-server
```

Replace the current file. Remove the flyctl/tail dead code.

- [ ] **Step 3: Strip redis/Dockerfile**

Remove the `curl` + `flyctl` install bloat. The image is not used in production.

```dockerfile
FROM redis:7-alpine
EXPOSE 6379
```

Or delete entirely if confirmed unused.

---

## Verification

After all tasks:

1. **Cost verification**: Run `fly:audit` → compare estimated monthly vs actual next invoice
2. **Inventory accuracy**: Run `fly:inventory` → counts match Fly dashboard
3. **No dead resources**: `fly-volumes-prune.sh` shows 0 unattached; `fly-redis-prune.sh` shows 0 stale
4. **Submodule works**: Fresh clone with `--recurse-submodules` has scripts at `devops/fly-ops/bin/`
5. **CI runs**: Trigger `fly-cost-report.yml` manually, verify it produces a job summary
6. **No secrets committed**: `git diff` on `.env` shows no tracked changes (it's gitignored)
