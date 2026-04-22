/**
 * Validate Redis snapshot schema for local development seeding.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type SnapshotKey = { key: string; value: string; ttlSeconds?: number | null };
type SnapshotSet = { key: string; members: string[]; ttlSeconds?: number | null };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath =
  process.env.REDIS_SNAPSHOT_PATH ||
  path.join(__dirname, "..", "resources", "data", "redis-snapshot.json");

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fail(message: string): never {
  console.error(`[redis-snapshot-validate] ${message}`);
  process.exit(1);
}

function validateSnapshot(raw: string): { keys: SnapshotKey[]; sets: SnapshotSet[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Snapshot is not valid JSON: ${message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    fail("Snapshot root must be an object.");
  }

  const candidate = parsed as { keys?: unknown; sets?: unknown };
  if (!Array.isArray(candidate.keys)) fail("Snapshot must contain a keys array.");
  if (!Array.isArray(candidate.sets)) fail("Snapshot must contain a sets array.");

  candidate.keys.forEach((entry, idx) => {
    if (!entry || typeof entry !== "object") fail(`keys[${idx}] must be an object.`);
    const keyEntry = entry as Record<string, unknown>;
    if (typeof keyEntry.key !== "string" || keyEntry.key.length === 0) {
      fail(`keys[${idx}].key must be a non-empty string.`);
    }
    if (typeof keyEntry.value !== "string") {
      fail(`keys[${idx}].value must be a string.`);
    }
    if (
      keyEntry.ttlSeconds !== undefined &&
      keyEntry.ttlSeconds !== null &&
      (!isFiniteNumber(keyEntry.ttlSeconds) || keyEntry.ttlSeconds < 0)
    ) {
      fail(`keys[${idx}].ttlSeconds must be null, undefined, or a non-negative number.`);
    }
  });

  candidate.sets.forEach((entry, idx) => {
    if (!entry || typeof entry !== "object") fail(`sets[${idx}] must be an object.`);
    const setEntry = entry as Record<string, unknown>;
    if (typeof setEntry.key !== "string" || setEntry.key.length === 0) {
      fail(`sets[${idx}].key must be a non-empty string.`);
    }
    if (
      !Array.isArray(setEntry.members) ||
      setEntry.members.some((member) => typeof member !== "string")
    ) {
      fail(`sets[${idx}].members must be an array of strings.`);
    }
    if (
      setEntry.ttlSeconds !== undefined &&
      setEntry.ttlSeconds !== null &&
      (!isFiniteNumber(setEntry.ttlSeconds) || setEntry.ttlSeconds < 0)
    ) {
      fail(`sets[${idx}].ttlSeconds must be null, undefined, or a non-negative number.`);
    }
  });

  return {
    keys: candidate.keys as SnapshotKey[],
    sets: candidate.sets as SnapshotSet[],
  };
}

function main(): void {
  if (!fs.existsSync(snapshotPath)) {
    fail(`Snapshot not found at ${snapshotPath}`);
  }

  const raw = fs.readFileSync(snapshotPath, "utf8");
  const { keys, sets } = validateSnapshot(raw);
  console.log(
    `[redis-snapshot-validate] OK path=${snapshotPath} keys=${keys.length} sets=${sets.length}`,
  );
}

main();
