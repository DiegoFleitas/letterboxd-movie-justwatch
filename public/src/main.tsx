import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { PostHogProvider, usePostHog } from "@posthog/react";
import { App } from "./App";
import { captureFrontendException, initFrontendSentry } from "./sentry";

function PostHogWindowRef(): null {
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog) {
      if (import.meta.env.DEV && typeof window !== "undefined")
        (window as { posthog?: unknown }).posthog = posthog;
      posthog.register({
        environment: import.meta.env.DEV ? "development" : "production",
      });
    }
  }, [posthog]);
  return null;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  initFrontendSentry();
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sentryDummyFe") === "1") {
      captureFrontendException(new Error("Dummy FE Sentry error"), {
        tags: { source: "dummy", layer: "frontend" },
        extra: { query: window.location.search },
      });
    }
    if (params.get("sentryDummyBe") === "1") {
      fetch("/api/sentry-test?mode=throw")
        .then(() => {})
        .catch((err: unknown) => {
          captureFrontendException(err, {
            tags: { source: "dummy", layer: "frontend", endpoint: "/api/sentry-test" },
          });
        });
    }
  }

  const key =
    (typeof window !== "undefined" && window.__POSTHOG_KEY__) ||
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const host =
    (typeof window !== "undefined" && window.__POSTHOG_HOST__) ||
    import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
    "https://us.i.posthog.com";

  const options = {
    api_host: host,
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
