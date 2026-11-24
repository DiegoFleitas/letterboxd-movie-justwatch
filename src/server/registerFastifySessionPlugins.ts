import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyFormbody from "@fastify/formbody";

export const MINIMUM_PRODUCTION_APP_SECRET_KEY_LENGTH = 32;

/**
 * SHA-256 digests of placeholder secrets that shipped in `.env.example` or docs.
 * Compared by digest so the offending literal never lives in this module.
 */
const KNOWN_WEAK_APP_SECRET_KEY_SHA256 = new Set([
  // Value shipped in `.env.example` before wave 2 (50 chars, removed upstream).
  "980a9912345375298953550bc8870c4df5327ececabb45256f028081573f85e6",
]);

/** Case-insensitive substrings that only appear in hand-written placeholder secrets. */
const KNOWN_WEAK_APP_SECRET_KEY_SUBSTRINGS = [
  "changeme",
  "change-me",
  "change_me",
  "your-secret",
  "your_secret",
  "placeholder",
  "example",
  "secret",
  "insecure",
  "do-not-use",
  "dev-only",
  "supersecret",
  "topsecret",
  "default-secret",
  "session-secret",
];

export function isKnownWeakAppSecretKey(appSecretKey: string): boolean {
  const normalized = appSecretKey.trim().toLowerCase();
  if (KNOWN_WEAK_APP_SECRET_KEY_SUBSTRINGS.some((needle) => normalized.includes(needle))) {
    return true;
  }
  const digest = createHash("sha256").update(appSecretKey).digest("hex");
  return KNOWN_WEAK_APP_SECRET_KEY_SHA256.has(digest);
}

/**
 * Production sessions must use a real secret: present, long enough to resist
 * brute force, and not a value copied from a template. Dev/test behavior is
 * unchanged — without `NODE_ENV=production` a random secret is generated.
 */
export function assertProductionAppSecretKeyIsUsable(appSecretKey: string | undefined): void {
  if (!appSecretKey) {
    throw new Error("APP_SECRET_KEY environment variable must be set in production.");
  }
  if (appSecretKey.length < MINIMUM_PRODUCTION_APP_SECRET_KEY_LENGTH) {
    throw new Error(
      `APP_SECRET_KEY must be at least ${MINIMUM_PRODUCTION_APP_SECRET_KEY_LENGTH} characters in production.`,
    );
  }
  if (isKnownWeakAppSecretKey(appSecretKey)) {
    throw new Error(
      "APP_SECRET_KEY must not be a well-known default or placeholder in production.",
    );
  }
}

export function registerFastifySessionPlugins(app: FastifyInstance): void {
  const appSecretKey = process.env.APP_SECRET_KEY;
  if (process.env.NODE_ENV === "production") {
    assertProductionAppSecretKeyIsUsable(appSecretKey);
  }
  const sessionSecret = appSecretKey || randomBytes(32).toString("hex");

  app.register(fastifyCookie, {
    secret: sessionSecret,
  });

  app.register(fastifySession, {
    secret: sessionSecret,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  });

  app.register(fastifyFormbody);
}
