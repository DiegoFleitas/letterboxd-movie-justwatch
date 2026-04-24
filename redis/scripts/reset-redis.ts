/**
 * Smart local Redis reset.
 * - If snapshot exists: validate + seed
 * - If snapshot is missing: export + validate + seed
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath =
  process.env.REDIS_SNAPSHOT_PATH || path.join(__dirname, "..", "data", "redis-snapshot.json");

type Step = {
  label: string;
  command: string;
};

async function runStep(step: Step): Promise<void> {
  console.log(`[redis-reset] ${step.label}`);
  try {
    const { stdout, stderr } = await exec(step.command, { cwd: process.cwd() });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout?.trim()) console.log(err.stdout.trim());
    if (err.stderr?.trim()) console.error(err.stderr.trim());
    throw new Error(
      `[redis-reset] ${step.label} failed: ${err.stderr || err.message || "unknown error"}`,
      {
        cause: error,
      },
    );
  }
}

async function main(): Promise<void> {
  const hasSnapshot = fs.existsSync(snapshotPath);
  const steps: Step[] = hasSnapshot
    ? [
        { label: "Validating Redis snapshot", command: "bun run seed:validate" },
        { label: "Seeding Redis from snapshot", command: "bun run seed-redis" },
      ]
    : [
        { label: "Exporting Redis snapshot", command: "bun run export-redis" },
        { label: "Validating Redis snapshot", command: "bun run seed:validate" },
        { label: "Seeding Redis from snapshot", command: "bun run seed-redis" },
      ];

  console.log(`[redis-reset] snapshot_path=${snapshotPath}`);
  console.log(`[redis-reset] snapshot_found=${hasSnapshot}`);

  for (const step of steps) {
    await runStep(step);
  }

  console.log(`[redis-reset] completed steps=${steps.length}`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
