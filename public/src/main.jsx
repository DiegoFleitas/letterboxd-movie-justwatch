import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";
import { App } from "./App.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (typeof window !== "undefined" && key) {
    const isDev = import.meta.env.DEV;
    posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_exceptions: true,
    });
    posthog.register({ environment: isDev ? "development" : "production" });
  }

  createRoot(rootEl).render(
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  );
}
