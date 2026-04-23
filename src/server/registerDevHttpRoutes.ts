import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { DEV_HTTP_API_PREFIX } from "./routes.js";
import { devRedisApisAllowedOrReply, isNodeProductionEnvironment } from "./lib/devApiGuard.js";
import {
  clearCacheByCategory,
  estimateSearchMovieStringKeyCount,
  getCacheCategoryCount,
} from "./lib/redis.js";
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from "./httpStatusCodes.js";

const exec = promisify(execCallback);

async function runDevCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await exec(command, { cwd: process.cwd() });
  return { stdout, stderr };
}

function toDevCommandError(
  operation: string,
  fallback: string,
  error: unknown,
): { error: string; stdout: string; stderr: string; operation: string; nextSteps: string[] } {
  const err = error as { stdout?: string; stderr?: string; message?: string };
  return {
    operation,
    error: err.stderr || err.message || fallback,
    stdout: err.stdout || "",
    stderr: err.stderr || "",
    nextSteps: [
      "Verify local Redis is running and reachable.",
      "Run the command manually from repo root for full logs.",
      "Confirm Redis dev guard environment settings allow local target.",
    ],
  };
}

/** Scoped `/api/dev/*` routes (guarded by devApiGuard). No-op in production. */
export function registerDevHttpRoutes(app: FastifyInstance): void {
  if (isNodeProductionEnvironment()) return;

  void app.register(
    async (dev) => {
      await dev.register(rateLimit, {
        max: 15,
        timeWindow: "1 minute",
        hook: "onRequest",
      });

      dev.post("/clear-list-cache", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        const result = await clearCacheByCategory("list");
        reply.send({ ok: true, ...result });
      });

      dev.get("/cache-status", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        const redisKeyPrefix = process.env.FLY_APP_NAME || "app";
        const [watchlistResult, listResult, searchMovieResult, searchMovieScan] = await Promise.all(
          [
            getCacheCategoryCount("watchlist"),
            getCacheCategoryCount("list"),
            getCacheCategoryCount("search-movie"),
            estimateSearchMovieStringKeyCount(),
          ],
        );
        const error =
          watchlistResult.error ||
          listResult.error ||
          searchMovieResult.error ||
          searchMovieScan.error;
        reply.send({
          ok: !error,
          redisKeyPrefix,
          watchlistCacheEntries: watchlistResult.count,
          hasWatchlistCache: watchlistResult.count > 0,
          listCacheEntries: listResult.count,
          hasListCache: listResult.count > 0,
          searchMovieCacheEntries: searchMovieResult.count,
          hasSearchMovieCache: searchMovieResult.count > 0,
          searchMovieApproxStringKeys: searchMovieScan.approxSearchMovieStringKeys,
          searchMovieScannedStringKeys: searchMovieScan.scannedStringKeys,
          searchMovieUnindexedApprox: Math.max(
            0,
            searchMovieScan.approxSearchMovieStringKeys - searchMovieResult.count,
          ),
          error,
        });
      });

      dev.post("/reset-redis", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        try {
          const { stdout, stderr } = await runDevCommand("bun run redis:reset");
          reply.send({
            ok: true,
            message: "Redis reset completed. Snapshot was validated and Redis was seeded.",
            stdout,
            stderr,
          });
        } catch (error) {
          reply
            .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
            .send(
              toDevCommandError("reset-redis", "Failed to reset Redis snapshot workflow", error),
            );
        }
      });

      dev.post("/export-redis", async (_request, reply) => {
        if (!devRedisApisAllowedOrReply(reply)) return;
        try {
          const { stdout, stderr } = await runDevCommand("bun run export-redis");
          reply.send({ ok: true, stdout, stderr });
        } catch (error) {
          reply
            .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
            .send(toDevCommandError("export-redis", "Failed to export Redis snapshot", error));
        }
      });
    },
    { prefix: DEV_HTTP_API_PREFIX },
  );
}
