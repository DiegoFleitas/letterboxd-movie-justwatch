/**
 * Injects PostHog key and host into app HTML so the frontend can read them at runtime.
 * Required when the key is only available at runtime (e.g. Fly secrets), not at Vite build time.
 */

export function injectPosthogConfig(html, posthogKey = "", posthogHost = "https://us.i.posthog.com") {
  const script = `<script>window.__POSTHOG_KEY__=${JSON.stringify(posthogKey)};window.__POSTHOG_HOST__=${JSON.stringify(posthogHost)};</script>`;
  return html.replace("</head>", script + "\n</head>");
}
