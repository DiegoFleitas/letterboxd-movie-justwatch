import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/**
 * Returns a PostHog client when POSTHOG_KEY is set; otherwise null.
 */
export function getPosthog(): PostHog | null {
  if (client !== null) return client;
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  client = new PostHog(key, { host });
  return client;
}

/**
 * Shuts down the PostHog client, flushing any queued events.
 */
export async function shutdownPosthog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}

/** Reset cached client. Only for tests. */
export function _resetPosthogForTesting(): void {
  client = null;
}
