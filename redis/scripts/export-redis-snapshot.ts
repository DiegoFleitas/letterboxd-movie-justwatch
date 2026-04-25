/**
 * Export Redis cache snapshot to a JSON file.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import Redis from "ioredis";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.FLYIO_REDIS_URL || "redis://localhost:6379";
const prefix = process.env.FLY_APP_NAME || "app";
const matchPattern = `${prefix}:*`;
const outPath =
  process.env.REDIS_SNAPSHOT_PATH || path.join(__dirname, "..", "data", "redis-snapshot.json");

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
      `Refusing non-local Redis host "${host}" when exporting the Redis snapshot. Set ALLOW_NON_LOCAL_REDIS=1 or ALLOW_NON_LOCAL_REDIS=true to override.`,
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

type RedisLike = {
  ping: () => Promise<unknown>;
  quit: () => void;
  scanStream: (opts: { match: string; count: number }) => NodeJS.EventEmitter;
  type: (key: string) => Promise<string>;
  pttl: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  smembers: (key: string) => Promise<string[]>;
};

async function scanSortedKeyBatch(redis: RedisLike, pattern: string): Promise<string[]> {
  const stream = redis.scanStream({ match: pattern, count: 100 });
  const keyBatch: string[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (keyList: string[]) => {
      keyBatch.push(...keyList);
    });
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  keyBatch.sort((a, b) => a.localeCompare(b));
  return keyBatch;
}

function ttlFromPttl(pttl: number): number | null | undefined {
  if (pttl === -2) return undefined;
  return pttl === -1 ? null : Math.floor(pttl / 1000);
}

async function ingestStringKey(
  redis: RedisLike,
  key: string,
  ttlSeconds: number | null,
): Promise<
  { record: { key: string; ttlSeconds: number | null; value: string } } | "skip" | "absent"
> {
  const value = await redis.get(key);
  if (value == null) return "absent";
  if (isErrorLikePayload(value)) return "skip";
  return { record: { key, ttlSeconds, value } };
}

async function ingestSetKey(
  redis: RedisLike,
  key: string,
  ttlSeconds: number | null,
): Promise<{ key: string; ttlSeconds: number | null; members: string[] }> {
  const members = await redis.smembers(key);
  return {
    key,
    ttlSeconds,
    members: [...members].sort((a, b) => a.localeCompare(b)),
  };
}

async function collectSnapshotRecords(
  redis: RedisLike,
  pattern: string,
): Promise<{
  keys: { key: string; ttlSeconds: number | null; value: string }[];
  sets: { key: string; ttlSeconds: number | null; members: string[] }[];
  skippedErrorLikeKeys: number;
}> {
  const keyBatch = await scanSortedKeyBatch(redis, pattern);
  const keys: { key: string; ttlSeconds: number | null; value: string }[] = [];
  const sets: { key: string; ttlSeconds: number | null; members: string[] }[] = [];
  let skippedErrorLikeKeys = 0;

  for (const key of keyBatch) {
    const pttl = await redis.pttl(key);
    const ttlSeconds = ttlFromPttl(pttl);
    if (ttlSeconds === undefined) continue;
    const type = await redis.type(key);
    if (type === "string") {
      const outcome = await ingestStringKey(redis, key, ttlSeconds);
      if (outcome === "skip") skippedErrorLikeKeys++;
      else if (outcome !== "absent") keys.push(outcome.record);
    } else if (type === "set") {
      sets.push(await ingestSetKey(redis, key, ttlSeconds));
    }
  }

  keys.sort((a, b) => a.key.localeCompare(b.key));
  sets.sort((a, b) => a.key.localeCompare(b.key));
  return { keys, sets, skippedErrorLikeKeys };
}

async function exportSnapshot(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const redis = new (Redis as any)(url, { maxRetriesPerRequest: 1 }) as RedisLike;

  try {
    assertLocalRedisTarget(url);
    await redis.ping();
    console.log(`[redis-export] source=${sanitizeRedisUrl(url)} prefix=${prefix}`);

    const { keys, sets, skippedErrorLikeKeys } = await collectSnapshotRecords(redis, matchPattern);

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

await exportSnapshot();
