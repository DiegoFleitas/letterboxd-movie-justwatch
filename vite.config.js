import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Strip React DevTools script from HTML in production builds. */
function stripDevToolsScript() {
  return {
    name: "strip-react-devtools",
    transformIndexHtml(html, ctx) {
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
  root: "public", // Set the project root to the 'public' folder
  build: {
    outDir: "dist", // Set the output directory for the production build
  },
  server: {
    proxy: {
      // Set up a proxy for requests starting with "/api"
      "/api": {
        // Forward the requests to the Express server running at this URL
        target: "http://localhost:3000",
        // Change the request's origin to the target URL (helps avoid CORS issues)
        changeOrigin: true,
      },
    },
  },
});
