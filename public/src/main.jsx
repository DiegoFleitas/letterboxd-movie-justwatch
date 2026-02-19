import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";
import { App } from "./App.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  // Prefer runtime-injected config (from server, so Fly secrets work); fall back to build-time env
  const key =
    (typeof window !== "undefined" && window.__POSTHOG_KEY__) ||
    import.meta.env.VITE_POSTHOG_KEY;
  const host =
    (typeof window !== "undefined" && window.__POSTHOG_HOST__) ||
    import.meta.env.VITE_POSTHOG_HOST ||
    "https://us.i.posthog.com";

  if (key) {
    posthog.init(key, {
      api_host: host,
      capture_exceptions: true,
    });
    posthog.register({ environment: import.meta.env.DEV ? "development" : "production" });
    if (typeof window !== "undefined") window.posthog = posthog;
  }

  createRoot(rootEl).render(
    key ? (
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )
  );
}
