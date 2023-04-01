import { defineConfig } from "vite";

export default defineConfig({
  root: "public", // Set the project root to the 'public' folder
  build: {
    outDir: "dist", // Set the output directory for the production build
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
