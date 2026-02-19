import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";
import { App } from "./App.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (key) {
    posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_exceptions: true,
    });
    posthog.register({ environment: import.meta.env.DEV ? "development" : "production" });
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
