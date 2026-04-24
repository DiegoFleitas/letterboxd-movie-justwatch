import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules",
      "dist",
      "build",
      "src/client/dist",
      "tests/playwright-report",
      "tests/test-results",
      "coverage",
      ".turbo",
      ".cache",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        localStorage: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      // TypeScript already checks for undefined variables.
      "no-undef": "off",
      // TS + module resolution is handled by the TS compiler, so this rule
      // tends to produce noise in this project.
      "import/no-unresolved": "off",
      "import/named": "off",
    },
  },
  {
    files: ["src/client/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      // `tsconfig` uses `"jsx": "react-jsx"` — React import is not required for JSX.
      "react/react-in-jsx-scope": "off",
      ...reactHooks.configs.recommended.rules,
      // Hooks v7 adds stricter rules beyond classic `rules-of-hooks` / `exhaustive-deps`;
      // keep those on without forcing a large effect/refactor pass in this change.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      ...jsxA11y.configs.recommended.rules,
    },
    settings: {
      react: {
        // Explicit version avoids eslint-plugin-react calling removed ESLint 10
        // `context.getFilename()` during `"detect"` (see jsx-eslint/eslint-plugin-react#3977).
        version: "19.0",
      },
    },
  },
  {
    files: ["tests/**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
  },
  {
    files: ["playwright.config.*", "tests/e2e/**/*.ts"],
    languageOptions: {
      globals: {
        test: "readonly",
        expect: "readonly",
      },
    },
  },
];
