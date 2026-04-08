import "dotenv/config";
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  if (
    process.env.SENTRY_CAPTURE_HTTP_5XX === undefined ||
    process.env.SENTRY_CAPTURE_HTTP_5XX === ""
  ) {
    process.env.SENTRY_CAPTURE_HTTP_5XX = "true";
  }

  const tracesSampleRate = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");
  const rate = Number.isFinite(tracesSampleRate) ? Math.min(Math.max(tracesSampleRate, 0), 1) : 0;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    integrations: [Sentry.fastifyIntegration()],
    tracesSampleRate: rate,
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
  });
}
