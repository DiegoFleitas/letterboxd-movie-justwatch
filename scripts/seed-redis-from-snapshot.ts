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
  process.env.REDIS_SNAPSHOT_PATH ||
  path.join(__dirname, "..", "resources", "data", "redis-snapshot.json");
const url = process.env.SEED_REDIS_URL || process.env.FLYIO_REDIS_URL || "redis://localhost:6379";

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
