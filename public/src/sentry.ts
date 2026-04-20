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

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

export function initFrontendSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE ?? "development",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    tracesSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
    sendDefaultPii: import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII === "true",
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
