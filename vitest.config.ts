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
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: true,
    // @fastify/session requires ≥32 chars; CI often has no APP_SECRET_KEY
    env: {
      APP_SECRET_KEY: "dev-only-session-secret-do-not-use-in-production!!",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      /** json-summary + json: required/recommended by davelosert/vitest-coverage-report-action (CI job summary) */
      reporter: ["text", "text-summary", "json-summary", "json", "lcov", "html"],
      /** Emit lcov/json even when a test fails so CI artifacts stay useful */
      reportOnFailure: true,
      include: ["src/server/**/*.ts", "src/client/src/**/*.{ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "**/*.d.ts",
        "**/dist/**",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "tests/testPosterFlow.test.ts",
        /** Pure bootstrap / barrel files (covered by integration or not meaningful to unit-test). */
        "src/client/src/main.tsx",
        "src/client/src/consts.ts",
        "src/server/main.ts",
        "src/server/instrument.ts",
        "src/server/httpContext.ts",
        "src/server/controllers/index.ts",
        "src/server/lib/types/index.ts",
      ],
      thresholds: {
        statements: 80,
        lines: 80,
      },
    },
  },
});
