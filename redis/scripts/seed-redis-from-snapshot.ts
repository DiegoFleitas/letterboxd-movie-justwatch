/**
 * Restore/seed Redis from a snapshot JSON file.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import Redis from "ioredis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath =
  process.env.REDIS_SNAPSHOT_PATH || path.join(__dirname, "..", "data", "redis-snapshot.json");
const url = process.env.SEED_REDIS_URL || process.env.FLYIO_REDIS_URL || "redis://localhost:6379";

function assertLocalRedisTarget(redisUrl: string): void {
  if (process.env.ALLOW_NON_LOCAL_REDIS === "1" || process.env.ALLOW_NON_LOCAL_REDIS === "true")
    return;
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "redis"]);
  let host: string;
  try {
    host = new URL(redisUrl).hostname;
  } catch {
    throw new Error(
      `Invalid Redis URL: ${redisUrl}. Set ALLOW_NON_LOCAL_REDIS=1 or ALLOW_NON_LOCAL_REDIS=true if you intentionally need a non-local target.`,
    );
  }
  if (!allowedHosts.has(host)) {
    throw new Error(
      `Refusing non-local Redis host "${host}" for local-dev seed refresh. Set ALLOW_NON_LOCAL_REDIS=1 or ALLOW_NON_LOCAL_REDIS=true to override.`,
    );
  }
}

async function seedFromSnapshot(): Promise<void> {
  if (!fs.existsSync(snapshotPath)) {
    console.error(`Snapshot not found: ${snapshotPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(snapshotPath, "utf8");
  const { keys = [], sets = [] } = JSON.parse(raw) as {
    keys?: { key: string; ttlSeconds?: number | null; value: string }[];
    sets?: { key: string; members?: string[] }[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const redis = new (Redis as any)(url, { maxRetriesPerRequest: 1 });

  try {
    assertLocalRedisTarget(url);
    for (const { key, ttlSeconds, value } of keys) {
      if (ttlSeconds != null && ttlSeconds > 0) {
        await redis.set(key, value, "EX", ttlSeconds);
      } else {
        await redis.set(key, value);
      }
    }
    for (const { key, members } of sets) {
      if (members && members.length > 0) {
        await redis.sadd(key, ...members);
      }
    }
    console.log(`Restored ${keys.length} keys and ${sets.length} sets to Redis`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    redis.quit();
  }
}

seedFromSnapshot();
