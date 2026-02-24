/**
 * Injects PostHog key and host into app HTML so the frontend can read them at runtime.
 * Optionally injects canonical provider map by clearName for data-driven normalization.
 */
export function injectPosthogConfig(
  html: string,
  posthogKey: string = "",
  posthogHost: string = "https://us.i.posthog.com",
  canonicalByNames: Record<string, { id: string; name: string }> | null = null
): string {
  const safePosthogKey = JSON.stringify(posthogKey).replace(/<\/script>/g, "<\\/script>");
  const safePosthogHost = JSON.stringify(posthogHost).replace(/<\/script>/g, "<\\/script>");
  let script = `<script>window.__POSTHOG_KEY__=${safePosthogKey};window.__POSTHOG_HOST__=${safePosthogHost};`;
  if (canonicalByNames != null) {
    const safeCanonical = JSON.stringify(canonicalByNames).replace(/<\/script>/g, "<\\/script>");
    script += `window.__CANONICAL_PROVIDERS_BY_NAME__=${safeCanonical};`;
  }
  script += `</script>`;
  return html.replace(/<\/head>/i, (match) => script + "\n" + match);
}
