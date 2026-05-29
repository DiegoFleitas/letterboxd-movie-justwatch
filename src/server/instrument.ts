import "dotenv/config";
import * as Sentry from "@sentry/node";
import { resolveTracesSampleRate } from "./lib/sentryTracesSampleRate.js";

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    integrations: [Sentry.fastifyIntegration()],
    tracesSampleRate: resolveTracesSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
  });
}
