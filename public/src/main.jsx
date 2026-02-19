import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { PostHogProvider, usePostHog } from "@posthog/react";
import { App } from "./App.jsx";

function PostHogWindowRef() {
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog) {
      if (import.meta.env.DEV && typeof window !== "undefined") window.posthog = posthog;
      posthog.register({ environment: import.meta.env.DEV ? "development" : "production" });
    }
  }, [posthog]);
  return null;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  // Prefer runtime-injected config (from server, so Fly secrets work); fall back to build-time env
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
    defaults: "2026-01-30",
  };

  createRoot(rootEl).render(
    key ? (
      <PostHogProvider apiKey={key} options={options}>
        <PostHogWindowRef />
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )
  );
}
