import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

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
      "@devHttpApiPrefix": path.resolve(__dirname, "src/devHttpApiPrefix.ts"),
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
    },
  },
});
