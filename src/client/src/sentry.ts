import * as Sentry from "@sentry/react";

type SentryContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
};

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

function getRuntimeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function initFrontendSentry(): void {
  const dsn =
    getRuntimeString(window.__SENTRY_DSN__) || getRuntimeString(import.meta.env.VITE_SENTRY_DSN);
  if (!dsn) return;

  const environment =
    getRuntimeString(window.__SENTRY_ENVIRONMENT__) ||
    getRuntimeString(import.meta.env.MODE) ||
    "development";
  const release =
    getRuntimeString(window.__SENTRY_RELEASE__) ||
    getRuntimeString(import.meta.env.VITE_SENTRY_RELEASE);
  const tracesSampleRate = parseSampleRate(
    getRuntimeString(window.__SENTRY_TRACES_SAMPLE_RATE__) ||
      getRuntimeString(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    0,
  );
  const sendDefaultPii =
    getRuntimeString(window.__SENTRY_SEND_DEFAULT_PII__) === "true" ||
    import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII === "true";

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate,
    sendDefaultPii,
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [/^\//, "localhost", "127.0.0.1"],
  });
}

export function captureFrontendException(
  error: unknown,
  context: SentryContext & { transactionName?: string } = {},
): string {
  if (!Sentry.getClient()) return "";
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  return Sentry.captureException(normalizedError, {
    level: context.level,
    tags: context.tags,
    extra: context.extra,
    ...(context.transactionName ? { transactionName: context.transactionName } : {}),
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
