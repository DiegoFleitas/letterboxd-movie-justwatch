import type { FastifyInstance } from "fastify";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { DEV_HTTP_API_PREFIX } from "../devHttpApiPrefix.js";
import { devRedisApisAllowedOrReply, isNodeProductionEnvironment } from "./lib/devApiGuard.js";
import { clearCacheByCategory } from "./lib/redis.js";

const exec = promisify(execCallback);

/** Scoped `/api/dev/*` routes (guarded by devApiGuard). No-op in production. */
export function registerDevHttpRoutes(app: FastifyInstance): void {
  if (isNodeProductionEnvironment()) return;

  void app.register(
    async (dev) => {
      dev.post("/clear-list-cache", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        const result = await clearCacheByCategory("list");
        reply.send({ ok: true, ...result });
      });

      dev.post("/seed-redis", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        try {
          const { stdout, stderr } = await exec("bun run seed-redis", { cwd: process.cwd() });
          reply.send({ ok: true, stdout, stderr });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; message?: string };
          reply.code(500).send({
            error: err.stderr || err.message || "Failed to seed Redis from snapshot",
            stdout: err.stdout || "",
            stderr: err.stderr || "",
          });
        }
      });

      dev.post("/export-redis", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        try {
          const { stdout, stderr } = await exec("bun run export-redis", { cwd: process.cwd() });
          reply.send({ ok: true, stdout, stderr });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; message?: string };
          reply.code(500).send({
            error: err.stderr || err.message || "Failed to export Redis snapshot",
            stdout: err.stdout || "",
            stderr: err.stderr || "",
          });
        }
      });

      dev.post("/validate-redis-snapshot", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        try {
          const { stdout, stderr } = await exec("bun run seed:validate", { cwd: process.cwd() });
          reply.send({ ok: true, stdout, stderr });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; message?: string };
          reply.code(500).send({
            error: err.stderr || err.message || "Failed to validate Redis snapshot",
            stdout: err.stdout || "",
            stderr: err.stderr || "",
          });
        }
      });

      dev.post("/refresh-local-seed", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        try {
          const { stdout, stderr } = await exec("bun run seed:refresh:local", {
            cwd: process.cwd(),
          });
          reply.send({ ok: true, stdout, stderr });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; message?: string };
          reply.code(500).send({
            error: err.stderr || err.message || "Failed to refresh local Redis seed data",
            stdout: err.stdout || "",
            stderr: err.stderr || "",
          });
        }
      });
    },
    { prefix: DEV_HTTP_API_PREFIX },
  );
}
