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

function sanitizeRedisUrl(redisUrl: string): string {
  try {
    const parsed = new URL(redisUrl);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return redisUrl.replace(/:\/\/([^@]+)@/, "://***@");
  }
}

function assertLocalRedisTarget(redisUrl: string): void {
  if (process.env.ALLOW_NON_LOCAL_REDIS === "1") return;
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  let host: string;
  try {
    host = new URL(redisUrl).hostname;
  } catch {
    throw new Error(
      `Invalid Redis URL: ${redisUrl}. Set ALLOW_NON_LOCAL_REDIS=1 if you intentionally need a non-local target.`,
    );
  }
  if (!allowedHosts.has(host)) {
    throw new Error(
      `Refusing non-local Redis host "${host}" for local-dev seed refresh. Set ALLOW_NON_LOCAL_REDIS=1 to override.`,
    );
  }
}

function isErrorLikePayload(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as { error?: unknown; errors?: unknown; statusCode?: unknown };
    if (!parsed || typeof parsed !== "object") return false;
    if ("error" in parsed || "errors" in parsed) return true;
    if (typeof parsed.statusCode === "number" && parsed.statusCode >= 400) return true;
    return false;
  } catch {
    return false;
  }
}

async function exportSnapshot(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const redis = new (Redis as any)(url, { maxRetriesPerRequest: 1 });
  const keys: { key: string; ttlSeconds: number | null; value: string }[] = [];
  const sets: { key: string; ttlSeconds: number | null; members: string[] }[] = [];
  let skippedErrorLikeKeys = 0;

  try {
    assertLocalRedisTarget(url);
    await redis.ping();
    console.log(`[redis-export] source=${sanitizeRedisUrl(url)} prefix=${prefix}`);

    const stream = redis.scanStream({ match: matchPattern, count: 100 });
    const keyBatch: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (keyList: string[]) => {
        keyBatch.push(...keyList);
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    keyBatch.sort((a, b) => a.localeCompare(b));

    for (const key of keyBatch) {
      const type = await redis.type(key);
      const pttl = await redis.pttl(key);
      if (pttl === -2) continue;
      const ttlSeconds = pttl === -1 ? null : Math.floor(pttl / 1000);
      if (type === "string") {
        const value = await redis.get(key);
        if (value != null) {
          if (isErrorLikePayload(value)) {
            skippedErrorLikeKeys++;
            continue;
          }
          keys.push({ key, ttlSeconds, value });
        }
      } else if (type === "set") {
        const members = await redis.smembers(key);
        sets.push({ key, ttlSeconds, members: [...members].sort((a, b) => a.localeCompare(b)) });
      }
    }

    keys.sort((a, b) => a.key.localeCompare(b.key));
    sets.sort((a, b) => a.key.localeCompare(b.key));

    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ keys, sets }, null, 0), "utf8");
    if (skippedErrorLikeKeys > 0) {
      console.log(`Skipped ${skippedErrorLikeKeys} error-like cached entries from snapshot.`);
    }
    console.log(`Exported ${keys.length} keys and ${sets.length} sets to ${outPath}`);
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[redis-export] failed: ${message}`);
    console.error(
      "[redis-export] Ensure local Redis is reachable and FLYIO_REDIS_URL points to your local dev instance.",
    );
    process.exit(1);
  } finally {
    redis.quit();
  }
}

exportSnapshot();
