/**
 * Injects PostHog key and host into app HTML so the frontend can read them at runtime.
 * Required when the key is only available at runtime (e.g. Fly secrets), not at Vite build time.
 */

export function injectPosthogConfig(html, posthogKey = "", posthogHost = "https://us.i.posthog.com") {
  const safePosthogKey = JSON.stringify(posthogKey).replace(/<\/script>/g, "<\\/script>");
  const safePosthogHost = JSON.stringify(posthogHost).replace(/<\/script>/g, "<\\/script>");
  const script = `<script>window.__POSTHOG_KEY__=${safePosthogKey};window.__POSTHOG_HOST__=${safePosthogHost};</script>`;
  return html.replace(/<\/head>/i, (match) => script + "\n" + match);
}
