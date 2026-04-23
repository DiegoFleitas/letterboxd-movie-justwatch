import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/client/src"),
      "@server": path.resolve(__dirname, "src/server"),
    },
  },
  test: {
    root: __dirname,
    include: [
      "tests/**/*.test.ts",
      "src/client/src/__tests__/**/*.test.ts",
      "src/client/src/__tests__/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "tests/testPosterFlow.test.ts"],
    environment: "node",
    globals: true,
    // @fastify/session requires ≥32 chars; CI often has no APP_SECRET_KEY
    env: {
      APP_SECRET_KEY: "dev-only-session-secret-do-not-use-in-production!!",
    },
  },
});
