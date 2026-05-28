# fly-ops

Small **bash** helpers to **inventory** [Fly.io](https://fly.io) apps (Machines, volumes, Upstash Redis) and sanity-check **memory settings** against a `fly.toml`.

## Requirements

- [`flyctl`](https://fly.io/docs/flyctl/install/) (`fly`), authenticated
- [`jq`](https://jqlang.org/)

Ensure `fly` is on your `PATH` (often `export PATH="$HOME/.fly/bin:$PATH"`).

## Install

Clone and add `bin/` to `PATH`, or run scripts by path:

```bash
git clone https://github.com/DiegoFleitas/fly-ops.git
export PATH="$PWD/fly-ops/bin:$PATH"
```

To pin a version after releases exist:

```bash
git -C fly-ops checkout v0.1.0
```

## Scripts

| Script                   | Purpose                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `fly-inventory.sh`       | All apps → machines + volumes; ends with org **`fly redis list`**                                |
| `fly-volumes-risk.sh`    | Same as `fly-inventory.sh --volume-risk` (heuristic warnings)                                    |
| `fly-redis-audit.sh`     | `fly redis update --help`, `fly redis list`, `status` per DB if `--json` works                   |
| `fly-redis-prune.sh`     | Dry-run (default) drop stale Upstash DBs; keeps `movie-justwatch-redis` unless you `--keep` more |
| `fly-volumes-prune.sh`   | List or destroy **unattached** volumes (`attached_machine_id` empty) per app or whole org        |
| `fly-memory-check.sh`    | Print `[[vm]]` memory lines from a `fly.toml` + `fly scale show` hint                            |
| `fly-post-cost-check.sh` | Full inventory + billing/dashboard checklist                                                     |

### `fly-inventory.sh` flags

- `--activas-only` — only Machines in `started` or `running`
- `--volume-risk` — flag volumes with no attach id or attached Machine not running
- `-o` / `--org SLUG` — org for `fly redis list` (else `FLY_ORG` or inferred from `fly apps list`)

### `fly-memory-check.sh`

Resolves `fly.toml` in order:

1. `-f` / `--file PATH`
2. `FLY_TOML`
3. `./fly.toml` from the **current working directory**
4. Legacy: `../fly.toml` relative the script dir (works if you copy `bin/` into an app’s `scripts/` layout)

Examples:

```bash
cd /path/to/letterboxd-movie-justwatch
PATH="$HOME/.fly/bin:$PATH" /path/to/fly-ops/bin/fly-memory-check.sh -f fly.toml
```

```bash
FLY_TOML=/path/to/my-app/fly.toml fly-memory-check.sh
```

### `fly-redis-prune.sh`

Parses `fly redis list` (tab-separated `NAME` column), keeps **`movie-justwatch-redis`** by default, and lists other databases that would be destroyed.

```bash
./bin/fly-redis-prune.sh -o personal              # dry-run (default)
./bin/fly-redis-prune.sh -o personal --execute --yes   # run fly redis destroy -y for each non-kept name
```

Add **`--keep NAME`** (repeatable) for extra DBs to preserve, or **`--no-default-keep`** to only keep names you pass.

### `fly-volumes-prune.sh`

Scans `fly volumes list -j` per app. Any volume **not** bound to a machine matches what Fly shows as **unattached** (orphan billing). Does **not** remove volumes still bound to a stopped machine — destroy that machine first if you need the volume gone.

```bash
./bin/fly-volumes-prune.sh                    # dry-run, all apps
./bin/fly-volumes-prune.sh -a bold-feather-1773   # one app
./bin/fly-volumes-prune.sh --execute --yes    # destroy all unattached found
```

Use the same `-a` flags for dry-run and execute so scope matches.

## Environment

- **`FLY_ORG`** — default org slug for Redis list / audit when not passed as `-o`
- **`FLY_TOML`** — default path for `fly-memory-check.sh`

## Notes

- `[volume-risk]` is a **heuristic** — confirm in the Fly dashboard before `fly volumes destroy` (irreversible).
- **`fly-redis-prune.sh --execute`** deletes Upstash databases permanently — confirm app secrets (e.g. `FLYIO_REDIS_URL`) only reference instances you keep.
- **`fly-volumes-prune.sh --execute`** deletes volume data permanently. The UI can lag behind the API; refresh or run dry-run to confirm.
- Redis plan changes are **interactive**: `fly redis update <name>`. Pay-as-you-go vs fixed depends on command volume (see Fly Upstash docs).

## License

MIT — see [LICENSE](LICENSE).
