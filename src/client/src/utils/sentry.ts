import * as Sentry from "@sentry/react";

/** Matches server default in `src/server/lib/sentryCapture.ts`. */
const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

/**
 * Sentry v11 removed `sendDefaultPii` in favour of the granular `dataCollection` option, whose
 * defaults collect user info, cookies, headers and query params. The runtime opt-in flag stays
 * the single switch: unless it is `true`, every category that carries PII is turned off.
 */
const NO_PII_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  urlQueryParams: false,
  httpBodies: [],
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
};

type SentryContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
};

function resolveTracesSampleRate(raw: string | undefined, environment: string): number {
  const trimmed = raw?.trim();
  if (trimmed) {
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed)) return Math.min(Math.max(parsed, 0), 1);
  }
  return environment === "production" ? PRODUCTION_TRACES_SAMPLE_RATE : 0;
}

function getRuntimeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function initFrontendSentry(): void {
  const dsn =
    getRuntimeString((globalThis as { __SENTRY_DSN__?: string }).__SENTRY_DSN__) ||
    getRuntimeString(import.meta.env.VITE_SENTRY_DSN);
  if (!dsn) return;

  const environment =
    getRuntimeString((globalThis as { __SENTRY_ENVIRONMENT__?: string }).__SENTRY_ENVIRONMENT__) ||
    getRuntimeString(import.meta.env.MODE) ||
    "development";
  const release =
    getRuntimeString((globalThis as { __SENTRY_RELEASE__?: string }).__SENTRY_RELEASE__) ||
    getRuntimeString(import.meta.env.VITE_SENTRY_RELEASE);
  const tracesSampleRate = resolveTracesSampleRate(
    getRuntimeString(
      (globalThis as { __SENTRY_TRACES_SAMPLE_RATE__?: string }).__SENTRY_TRACES_SAMPLE_RATE__,
    ) || getRuntimeString(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    environment,
  );
  const sendPii =
    getRuntimeString(
      (globalThis as { __SENTRY_SEND_DEFAULT_PII__?: string }).__SENTRY_SEND_DEFAULT_PII__,
    ) === "true" || import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII === "true";

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate,
    // When the flag is on we omit the option entirely: v11's defaults match the old
    // `sendDefaultPii: true` behaviour. When it is off we must be explicit, because the same
    // defaults would otherwise send more data than `sendDefaultPii: false` ever did.
    ...(sendPii ? {} : { dataCollection: NO_PII_DATA_COLLECTION }),
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [/^\//, /\.fly\.dev$/i, "localhost", "127.0.0.1"],
  });
}

export function captureFrontendException(
  error: unknown,
  context: SentryContext & { transactionName?: string; fingerprint?: string[] } = {},
): string {
  if (!Sentry.getClient()) return "";
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  return Sentry.captureException(normalizedError, {
    level: context.level,
    tags: context.tags,
    extra: context.extra,
    ...(context.transactionName ? { transactionName: context.transactionName } : {}),
    ...(context.fingerprint ? { fingerprint: context.fingerprint } : {}),
  });
}

export function captureFrontendMessage(
  message: string,
  context: SentryContext & { fingerprint?: string[] } = {},
): string {
  if (!Sentry.getClient()) return "";
  return Sentry.captureMessage(message, {
    level: context.level ?? "error",
    tags: context.tags,
    extra: context.extra,
    ...(context.fingerprint ? { fingerprint: context.fingerprint } : {}),
  });
}
