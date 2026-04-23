# Redis and local dev

[`redis/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/redis) contains the **optional Docker image** (Redis + `flyctl` + curl), **Compose-oriented** docs, **`data/`** (canonical provider JSON + optional snapshot), and **`scripts/`** (export / seed / validate snapshot, build canonical providers).

Compose (`docker-compose.yml`) uses the stock **`redis:7-alpine`** service for local stacks; the custom image is for **CLI / Fly workflows** documented in the README below.

## Custom image (Redis CLI + Flyctl)

From the **`redis/`** directory (build context is this folder; see [`.dockerignore`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/redis/.dockerignore)):

```bash
docker build -t redis-cli-flyctl .
docker run -d -p 6379:6379 redis-cli-flyctl
```

Set `FLYIO_REDIS_URL="redis://localhost:6379"` in `.env` so the app uses that instance.

Useful commands inside the container: `redis-cli` (`KEYS *`, `GET`, `TTL`, `DEL`, `FLUSHDB`), and `flyctl redis connect` for Upstash.

## Snapshot export and seed

Scripts: [`redis/scripts/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/redis/scripts). Shortcuts from repo root (see [`package.json`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/package.json)):

| Script                    | Purpose                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `bun run redis:reset`     | Default smart reset: if snapshot exists -> validate+seed; if missing -> export+validate+seed |
| `bun run export-redis`    | Dump Redis keys/sets to `redis/data/redis-snapshot.json` (or `REDIS_SNAPSHOT_PATH`)          |
| `bun run seed-redis`      | Restore snapshot into target Redis (`SEED_REDIS_URL` / `FLYIO_REDIS_URL`)                    |
| `bun run seed:validate`   | Validate snapshot JSON schema                                                                |
| `bun run build:providers` | Regenerate `redis/data/canonical-providers.json`                                             |

**Recommended:** run `bun run redis:reset` for day-to-day local cache reset.

**Manual Export:** set `FLYIO_REDIS_URL`, optional `FLY_APP_NAME` for key prefix, then `bun run export-redis`.

**Manual Seed:** set `SEED_REDIS_URL` or rely on `FLYIO_REDIS_URL` / localhost defaults.

Scripts enforce **local-only** Redis targets unless `ALLOW_NON_LOCAL_REDIS` is set—see script sources for details.

## Gotchas

- **`bun run fly:deploy`** uses `.env`; a URL pointing at **local** Redis will break production deploy connectivity.

## Related

- [Commands](Commands)
- [Repository layout](Repository-layout)

**In-repo copy:** [`redis/README.md`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/redis/README.md).
