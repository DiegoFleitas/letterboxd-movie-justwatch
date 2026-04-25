import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { PostHogProvider, usePostHog } from "@posthog/react";
import { App } from "./App";
import { HTTP_API_PATHS, POSTHOG_PROXY_DEFAULT_PATH } from "@server/routes";
import { captureFrontendException, initFrontendSentry } from "./sentry";

type RuntimeConfigWindow = Window &
  typeof globalThis & {
    __POSTHOG_KEY__?: string;
    __POSTHOG_HOST__?: string;
  };

function PostHogWindowRef(): null {
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog) {
      if (import.meta.env.DEV && globalThis.window !== undefined)
        (globalThis as { posthog?: unknown }).posthog = posthog;
      posthog.register({
        environment: import.meta.env.DEV ? "development" : "production",
      });
    }
  }, [posthog]);
  return null;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const runtimeWindow = globalThis.window as RuntimeConfigWindow | undefined;
  initFrontendSentry();
  if (globalThis.window !== undefined) {
    const params = new URLSearchParams(globalThis.location.search);
    if (params.get("sentryDummyFe") === "1") {
      captureFrontendException(new Error("Dummy FE Sentry error"), {
        tags: { source: "dummy", layer: "frontend" },
        extra: {
          sentryDummyFe: params.get("sentryDummyFe") === "1",
          sentryDummyBe: params.get("sentryDummyBe") === "1",
        },
      });
    }
    if (params.get("sentryDummyBe") === "1") {
      try {
        await fetch(`${HTTP_API_PATHS.sentryTest}?mode=throw`);
      } catch (err: unknown) {
        captureFrontendException(err, {
          tags: { source: "dummy", layer: "frontend", endpoint: HTTP_API_PATHS.sentryTest },
        });
      }
    }
  }

  const key = runtimeWindow?.__POSTHOG_KEY__ || import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const host =
    runtimeWindow?.__POSTHOG_HOST__ ||
    import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
    POSTHOG_PROXY_DEFAULT_PATH;

  const options = {
    api_host: host,
    ui_host: "https://us.posthog.com",
    capture_exceptions: true,
  };

  createRoot(rootEl).render(
    key ? (
      <PostHogProvider apiKey={key} options={options}>
        <PostHogWindowRef />
        <App />
      </PostHogProvider>
    ) : (
      <App />
    ),
  );
}
