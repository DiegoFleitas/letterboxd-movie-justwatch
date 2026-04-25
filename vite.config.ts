import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { POSTHOG_PROXY_DEFAULT_PATH } from "./src/server/routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip React DevTools script from HTML in production builds. */
function stripDevToolsScript() {
  return {
    name: "strip-react-devtools",
    transformIndexHtml(html: string, ctx: { bundle?: unknown }) {
      if (ctx.bundle) {
        return html
          .replace(/\s*<!-- Dev only: connect to standalone React DevTools[^>]*-->\s*/i, "")
          .replace(/\s*<script src="http:\/\/localhost:8097"[^>]*><\/script>\s*/i, "");
      }
      return html;
    },
  };
}

export default defineConfig({
  plugins: [stripDevToolsScript(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/client/src"),
      "@server": path.resolve(__dirname, "src/server"),
    },
  },
  root: "src/client",
  build: {
    outDir: "dist",
    sourcemap: "hidden",
    rollupOptions: {
      input: path.resolve(__dirname, "src", "client", "index.html"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      [`^${POSTHOG_PROXY_DEFAULT_PATH}`]: {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
