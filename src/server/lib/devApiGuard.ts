import type { FastifyReply } from "fastify";

/** Hostnames treated as safe targets for dev-only Redis HTTP APIs (see docker-compose `redis` service). */
const DEFAULT_LOCAL_REDIS_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "redis"]);

export function parseRedisUrlHostname(redisUrl: string): string | null {
  try {
    return new URL(redisUrl).hostname;
  } catch {
    return null;
  }
}

/** True when `FLYIO_REDIS_URL` (or localhost default) points at an allowed local dev host, or override is set. */
export function isLocalRedisTarget(redisUrl: string): boolean {
  if (process.env.ALLOW_NON_LOCAL_REDIS === "1" || process.env.ALLOW_NON_LOCAL_REDIS === "true") {
    return true;
  }
  const host = parseRedisUrlHostname(redisUrl);
  if (!host) return false;
  if (DEFAULT_LOCAL_REDIS_HOSTS.has(host)) return true;
  const extra =
    process.env.DEV_REDIS_API_EXTRA_HOSTS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return extra.includes(host);
}

export function getEffectiveRedisUrlForDevGuard(): string {
  return process.env.SEED_REDIS_URL || process.env.FLYIO_REDIS_URL || "redis://localhost:6379";
}

export type DevApiGuardFailure =
  | { code: "production"; message: string }
  | { code: "redis_disabled"; message: string }
  | { code: "non_local_redis"; message: string };

/** Used to skip registering `/api/dev/*` entirely in production. */
export function isNodeProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getDevApiGuardFailure(): DevApiGuardFailure | null {
  if (isNodeProductionEnvironment()) {
    return { code: "production", message: "Not available in production" };
  }
  if (process.env.DISABLE_REDIS === "1" || process.env.DISABLE_REDIS === "true") {
    return {
      code: "redis_disabled",
      message: "Redis is disabled (DISABLE_REDIS); dev Redis APIs are unavailable",
    };
  }
  const url = getEffectiveRedisUrlForDevGuard();
  if (!isLocalRedisTarget(url)) {
    const host = parseRedisUrlHostname(url) ?? "unknown";
    return {
      code: "non_local_redis",
      message: `Dev Redis APIs require a local Redis host (configured: ${host}). Set ALLOW_NON_LOCAL_REDIS=1 only when intentional.`,
    };
  }
  return null;
}

export function sendDevApiGuardFailure(reply: FastifyReply, failure: DevApiGuardFailure): void {
  if (failure.code === "production") {
    reply.code(404).send({ error: failure.message });
    return;
  }
  reply.code(403).send({ error: failure.message });
}

/** If dev Redis APIs are not allowed, sends the response and returns false. */
export function devRedisApisAllowedOrReply(reply: FastifyReply): boolean {
  const failure = getDevApiGuardFailure();
  if (failure) {
    sendDevApiGuardFailure(reply, failure);
    return false;
  }
  return true;
}
