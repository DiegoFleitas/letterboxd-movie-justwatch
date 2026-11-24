import { setRuntimeConfigJs } from "./runtimeConfigAsset.js";

/**
 * Injects runtime frontend config into app HTML.
 * Includes PostHog values and optional provider + Sentry settings.
 */
export interface RuntimeSentryConfig {
  dsn?: string;
  release?: string;
  tracesSampleRate?: string;
  sendDefaultPii?: string;
  environment?: string;
}

export function injectRuntimeConfig(
  html: string,
  posthogKey: string = "",
  posthogHost: string = "/api/reversa",
  canonicalByNames: Record<string, { id: string; name: string }> | null = null,
  sentryConfig: RuntimeSentryConfig = {},
): string {
  const safePosthogKey = JSON.stringify(posthogKey).replaceAll("</script>", "<\\/script>");
  const safePosthogHost = JSON.stringify(posthogHost).replaceAll("</script>", "<\\/script>");
  const safeSentryDsn = JSON.stringify(sentryConfig.dsn ?? "").replaceAll(
    "</script>",
    "<\\/script>",
  );
  const safeSentryRelease = JSON.stringify(sentryConfig.release ?? "").replaceAll(
    "</script>",
    "<\\/script>",
  );
  const safeSentryTracesSampleRate = JSON.stringify(sentryConfig.tracesSampleRate ?? "").replaceAll(
    "</script>",
    "<\\/script>",
  );
  const safeSentrySendDefaultPii = JSON.stringify(sentryConfig.sendDefaultPii ?? "").replaceAll(
    "</script>",
    "<\\/script>",
  );
  const safeSentryEnvironment = JSON.stringify(sentryConfig.environment ?? "").replaceAll(
    "</script>",
    "<\\/script>",
  );
  let script = `<script>window.__POSTHOG_KEY__=${safePosthogKey};window.__POSTHOG_HOST__=${safePosthogHost};`;
  script += `window.__SENTRY_DSN__=${safeSentryDsn};`;
  script += `window.__SENTRY_RELEASE__=${safeSentryRelease};`;
  script += `window.__SENTRY_TRACES_SAMPLE_RATE__=${safeSentryTracesSampleRate};`;
  script += `window.__SENTRY_SEND_DEFAULT_PII__=${safeSentrySendDefaultPii};`;
  script += `window.__SENTRY_ENVIRONMENT__=${safeSentryEnvironment};`;
  if (canonicalByNames != null) {
    const safeCanonical = JSON.stringify(canonicalByNames).replaceAll("</script>", "<\\/script>");
    script += `window.__CANONICAL_PROVIDERS_BY_NAME__=${safeCanonical};`;
  }
  script += `</script>`;
  // Serve the config as an external same-origin script so `script-src 'self'` is enough
  // and `'unsafe-inline'` can be dropped from the CSP.
  setRuntimeConfigJs(script.replace(/^<script>/, "").replace(/<\/script>$/, ""));
  const externalScript = '<script src="/runtime-config.js"></script>';
  return html.replace(/<\/head>/i, (match) => externalScript + "\n" + match);
}
