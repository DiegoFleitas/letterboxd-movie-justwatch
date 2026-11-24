import "dotenv/config";
import * as Sentry from "@sentry/node";
import { resolveTracesSampleRate } from "./lib/sentryCapture.js";

/**
 * Sentry v11 removed `sendDefaultPii` in favour of the granular `dataCollection` option, whose
 * defaults collect user info, cookies, headers and query params. `SENTRY_SEND_DEFAULT_PII` stays
 * the single opt-in switch: unless it is `true`, every category that carries PII is turned off.
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

const SECRET_QUERY_PARAM = /([?&](?:api_key|apikey|token|access_token|key|secret)=)[^&\s"']+/gi;
const SECRET_OBJECT_KEY = /authorization|cookie|api[-_]?key|apikey|token|secret/i;

function scrubDeep(value: unknown): unknown {
  if (typeof value === "string") return value.replace(SECRET_QUERY_PARAM, "$1[REDACTED]");
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_OBJECT_KEY.test(key) ? "[REDACTED]" : scrubDeep(entry);
    }
    return out;
  }
  return value;
}

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  const sendPii = process.env.SENTRY_SEND_DEFAULT_PII === "true";
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    integrations: [Sentry.fastifyIntegration()],
    // Never ship API keys carried in URLs/headers to the event store.
    beforeSend(event) {
      return scrubDeep(event) as Sentry.ErrorEvent;
    },
    tracesSampleRate: resolveTracesSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    // When the flag is on we omit the option entirely: v11's defaults match the old
    // `sendDefaultPii: true` behaviour. When it is off we must be explicit, because the same
    // defaults would otherwise send more data than `sendDefaultPii: false` ever did.
    ...(sendPii ? {} : { dataCollection: NO_PII_DATA_COLLECTION }),
  });
}
