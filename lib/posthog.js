import { PostHog } from "posthog-node";

let client = null;

/**
 * Returns a PostHog client when POSTHOG_KEY is set; otherwise null.
 * With one project (e.g. free tier), set the key only in production so the project stays prod-only.
 */
export function getPosthog() {
  if (client !== null) return client;
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  client = new PostHog(key, { host });
  return client;
}

/**
 * Shuts down the PostHog client, flushing any queued events.
 * Call on process exit to avoid losing events during restarts or deployments.
 */
export async function shutdownPosthog() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}

/** Reset cached client. Only for tests. */
export function _resetPosthogForTesting() {
  client = null;
}
