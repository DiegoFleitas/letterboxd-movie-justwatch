import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getCanonicalProviderByNames } from "./lib/loadCanonicalProviders.js";
import { injectRuntimeConfig } from "./lib/injectRuntimeConfig.js";
import { POSTHOG_PROXY_DEFAULT_PATH } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildIndexHtmlForClient(): string | null {
  const distIndexPath = path.join(__dirname, "..", "client", "dist", "index.html");
  if (!fs.existsSync(distIndexPath)) return null;

  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = process.env.POSTHOG_HOST || POSTHOG_PROXY_DEFAULT_PATH;
  const html = fs.readFileSync(distIndexPath, "utf8");
  return injectRuntimeConfig(html, posthogKey, posthogHost, getCanonicalProviderByNames(), {
    dsn: process.env.SENTRY_DSN || "",
    release: process.env.SENTRY_RELEASE || "",
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE || "",
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII || "",
    environment: process.env.NODE_ENV || "",
  });
}
