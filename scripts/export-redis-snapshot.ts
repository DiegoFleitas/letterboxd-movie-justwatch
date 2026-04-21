/**
 * Export Redis cache snapshot to a JSON file.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import Redis from "ioredis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.FLYIO_REDIS_URL || "redis://localhost:6379";
const prefix = process.env.FLY_APP_NAME || "app";
const matchPattern = `${prefix}:*`;
const outPath =
  process.env.REDIS_SNAPSHOT_PATH ||
  path.join(__dirname, "..", "resources", "data", "redis-snapshot.json");

async function exportSnapshot(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const redis = new (Redis as any)(url, { maxRetriesPerRequest: 1 });
  const keys: { key: string; ttlSeconds: number | null; value: string }[] = [];
  const sets: { key: string; ttlSeconds: number | null; members: string[] }[] = [];

  try {
    const stream = redis.scanStream({ match: matchPattern, count: 100 });
    const keyBatch: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (keyList: string[]) => {
        keyBatch.push(...keyList);
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    for (const key of keyBatch) {
      const type = await redis.type(key);
      const pttl = await redis.pttl(key);
      if (pttl === -2) continue;
      const ttlSeconds = pttl === -1 ? null : Math.floor(pttl / 1000);
      if (type === "string") {
        const value = await redis.get(key);
        if (value != null) keys.push({ key, ttlSeconds, value });
      } else if (type === "set") {
        const members = await redis.smembers(key);
        sets.push({ key, ttlSeconds, members });
      }
    }

    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ keys, sets }, null, 0), "utf8");
    console.log(`Exported ${keys.length} keys and ${sets.length} sets to ${outPath}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    redis.quit();
  }
}

exportSnapshot();
