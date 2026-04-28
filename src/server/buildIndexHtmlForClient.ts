import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCanonicalProviderByNames } from "./lib/loadCanonicalProviders.js";
import { injectRuntimeConfig } from "./lib/injectRuntimeConfig.js";
import { POSTHOG_PROXY_DEFAULT_PATH } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveClientPosthogHost(rawHost: string | undefined): string {
  const host = rawHost?.trim();
  if (!host) return POSTHOG_PROXY_DEFAULT_PATH;
  // Force first-party proxy when env points directly at PostHog Cloud.
  if (/^https?:\/\/([a-z0-9-]+\.)*posthog\.com(\/|$)/i.test(host)) {
    return POSTHOG_PROXY_DEFAULT_PATH;
  }
  return host;
}

export function buildIndexHtmlForClient(): string | null {
  const distIndexPath = path.join(__dirname, "..", "client", "dist", "index.html");
  if (!fs.existsSync(distIndexPath)) return null;

  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = resolveClientPosthogHost(process.env.POSTHOG_HOST);
  const html = fs.readFileSync(distIndexPath, "utf8");
  return injectRuntimeConfig(html, posthogKey, posthogHost, getCanonicalProviderByNames(), {
    dsn: process.env.SENTRY_DSN || "",
    release: process.env.SENTRY_RELEASE || "",
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE || "",
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII || "",
    environment: process.env.NODE_ENV || "",
  });
}
