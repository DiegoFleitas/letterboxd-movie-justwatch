import { defineConfig } from "vite";

export default defineConfig({
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
