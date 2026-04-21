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
  posthogHost: string = "https://us.i.posthog.com",
  canonicalByNames: Record<string, { id: string; name: string }> | null = null,
  sentryConfig: RuntimeSentryConfig = {},
): string {
  const safePosthogKey = JSON.stringify(posthogKey).replace(/<\/script>/g, "<\\/script>");
  const safePosthogHost = JSON.stringify(posthogHost).replace(/<\/script>/g, "<\\/script>");
  const safeSentryDsn = JSON.stringify(sentryConfig.dsn ?? "").replace(
    /<\/script>/g,
    "<\\/script>",
  );
  const safeSentryRelease = JSON.stringify(sentryConfig.release ?? "").replace(
    /<\/script>/g,
    "<\\/script>",
  );
  const safeSentryTracesSampleRate = JSON.stringify(sentryConfig.tracesSampleRate ?? "").replace(
    /<\/script>/g,
    "<\\/script>",
  );
  const safeSentrySendDefaultPii = JSON.stringify(sentryConfig.sendDefaultPii ?? "").replace(
    /<\/script>/g,
    "<\\/script>",
  );
  const safeSentryEnvironment = JSON.stringify(sentryConfig.environment ?? "").replace(
    /<\/script>/g,
    "<\\/script>",
  );
  let script = `<script>window.__POSTHOG_KEY__=${safePosthogKey};window.__POSTHOG_HOST__=${safePosthogHost};`;
  script += `window.__SENTRY_DSN__=${safeSentryDsn};`;
  script += `window.__SENTRY_RELEASE__=${safeSentryRelease};`;
  script += `window.__SENTRY_TRACES_SAMPLE_RATE__=${safeSentryTracesSampleRate};`;
  script += `window.__SENTRY_SEND_DEFAULT_PII__=${safeSentrySendDefaultPii};`;
  script += `window.__SENTRY_ENVIRONMENT__=${safeSentryEnvironment};`;
  if (canonicalByNames != null) {
    const safeCanonical = JSON.stringify(canonicalByNames).replace(/<\/script>/g, "<\\/script>");
    script += `window.__CANONICAL_PROVIDERS_BY_NAME__=${safeCanonical};`;
  }
  script += `</script>`;
  return html.replace(/<\/head>/i, (match) => script + "\n" + match);
}
