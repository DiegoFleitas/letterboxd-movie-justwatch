import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: __dirname,
    include: [
      "tests/**/*.test.ts",
      "public/src/__tests__/**/*.test.ts",
      "public/src/__tests__/**/*.test.tsx",
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
