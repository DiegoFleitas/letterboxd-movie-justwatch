/**
 * Unit tests for PostHog integration (lib/posthog.js, runtime config injection, and frontend fallback)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TestSuite, assertEqual, assertTruthy, assertFalsy } from "./testUtils.js";
import { getPosthog, _resetPosthogForTesting } from "../lib/posthog.js";
import { injectPosthogConfig } from "../lib/injectPosthogConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suite = new TestSuite("PostHog");

const savedEnv = {};

suite.test("getPosthog returns null when POSTHOG_KEY is unset", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  savedEnv.POSTHOG_HOST = process.env.POSTHOG_HOST;
  delete process.env.POSTHOG_KEY;
  delete process.env.POSTHOG_HOST;

  const result = getPosthog();
  assertEqual(result, null, "getPosthog() should return null when POSTHOG_KEY is unset");

  process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
  if (savedEnv.POSTHOG_HOST !== undefined) process.env.POSTHOG_HOST = savedEnv.POSTHOG_HOST;
});

suite.test("getPosthog returns a client when POSTHOG_KEY is set", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";

  const result = getPosthog();
  assertTruthy(result, "getPosthog() should return a client when POSTHOG_KEY is set");
  assertTruthy(typeof result.capture === "function", "client should have capture method");

  if (savedEnv.POSTHOG_KEY !== undefined) {
    process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
  } else {
    delete process.env.POSTHOG_KEY;
  }
});

suite.test("getPosthog returns the same client on second call (caching)", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";

  const first = getPosthog();
  const second = getPosthog();
  assertEqual(first, second, "getPosthog() should return the same client (cached)");

  if (savedEnv.POSTHOG_KEY !== undefined) {
    process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
  } else {
    delete process.env.POSTHOG_KEY;
  }
});

suite.test("getPosthog respects POSTHOG_HOST when set", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  savedEnv.POSTHOG_HOST = process.env.POSTHOG_HOST;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";
  process.env.POSTHOG_HOST = "https://eu.i.posthog.com";

  const result = getPosthog();
  assertTruthy(result, "client should be created with custom host");
  // PostHog client stores options internally; we just verify we got a client when host was set
  assertTruthy(typeof result.capture === "function", "client should be valid");

  process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY ?? "";
  if (savedEnv.POSTHOG_HOST !== undefined) process.env.POSTHOG_HOST = savedEnv.POSTHOG_HOST;
  else delete process.env.POSTHOG_HOST;
});

suite.test("getPosthog returns null again after reset when key removed", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";
  getPosthog();
  _resetPosthogForTesting();
  delete process.env.POSTHOG_KEY;

  const result = getPosthog();
  assertFalsy(result, "after reset and unset key, getPosthog() should return null");

  if (savedEnv.POSTHOG_KEY !== undefined) process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
});

// --- Runtime config injection (prevents regression: PostHog key must work when only available at runtime, e.g. Fly secrets) ---

suite.test("injectPosthogConfig injects key and host into HTML", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const key = "phc_prod_abc123";
  const host = "https://eu.i.posthog.com";
  const result = injectPosthogConfig(html, key, host);

  assertTruthy(result.includes("window.__POSTHOG_KEY__"), "injected HTML must contain window.__POSTHOG_KEY__");
  assertTruthy(result.includes("window.__POSTHOG_HOST__"), "injected HTML must contain window.__POSTHOG_HOST__");
  assertTruthy(result.includes(key), "injected HTML must contain the key value");
  assertTruthy(result.includes(host), "injected HTML must contain the host value");
  assertTruthy(result.includes("</head>"), "original </head> must still be present");
});

suite.test("injectPosthogConfig escapes key so HTML is safe", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const key = 'phc_"quoted"';
  const result = injectPosthogConfig(html, key, "https://us.i.posthog.com");
  assertTruthy(result.includes("__POSTHOG_KEY__"), "key must be present");
  assertTruthy(result.includes("phc_"), "key value must appear (JSON-escaped)");
});

suite.test("injectPosthogConfig prevents </script> injection in key", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const maliciousKey = 'phc_</script><script>alert(1)</script>';
  const result = injectPosthogConfig(html, maliciousKey, "https://us.i.posthog.com");
  assertFalsy(
    result.includes("</script><script>"),
    "injectPosthogConfig must not allow </script> injection in the key"
  );
});

suite.test("injectPosthogConfig matches </HEAD> (case-insensitive)", () => {
  const htmlUpper = "<!DOCTYPE html><html><HEAD></HEAD><body></body></html>";
  const result = injectPosthogConfig(htmlUpper, "phc_test", "https://us.i.posthog.com");
  assertTruthy(result.includes("window.__POSTHOG_KEY__"), "must inject config even when </HEAD> is uppercase");
});

suite.test("injectPosthogConfig injects canonicalByNames when provided", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const canonicalByNames = { "HBO Max": { id: "max", name: "HBO Max" } };
  const result = injectPosthogConfig(html, "", "https://us.i.posthog.com", canonicalByNames);
  assertTruthy(result.includes("window.__CANONICAL_PROVIDERS_BY_NAME__"), "injected HTML must contain __CANONICAL_PROVIDERS_BY_NAME__");
  assertTruthy(result.includes('"max"'), "canonical id must appear (JSON-serialized)");
});

suite.test("injectPosthogConfig does not inject canonical when 4th arg is null/undefined", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const result = injectPosthogConfig(html, "k", "https://us.i.posthog.com", null);
  assertTruthy(result.includes("__POSTHOG_KEY__"));
  assertTruthy(!result.includes("__CANONICAL_PROVIDERS_BY_NAME__"));
});

suite.test("frontend main.jsx reads runtime config (window.__POSTHOG_KEY__) so Fly secrets work", () => {
  const mainPath = path.join(__dirname, "..", "public", "src", "main.jsx");
  const source = fs.readFileSync(mainPath, "utf8");
  assertTruthy(
    source.includes("window.__POSTHOG_KEY__"),
    "main.jsx must use window.__POSTHOG_KEY__ so PostHog works when key is only available at runtime (e.g. Fly secrets). Do not rely only on build-time env."
  );
  assertTruthy(
    source.includes("window.__POSTHOG_HOST__"),
    "main.jsx must use window.__POSTHOG_HOST__ for runtime config"
  );

  // Verify that the runtime config is actually used to initialize PostHog (via PostHogProvider), not just present in the source.
  // The key derived from window.__POSTHOG_KEY__ must be passed as apiKey to PostHogProvider.
  // Expected pattern: <PostHogProvider apiKey={key} ...> (single-line, no JSX line breaks between tag name and apiKey)
  assertTruthy(
    /PostHogProvider[^>]*apiKey=\{key\}/.test(source),
    "main.jsx must pass the runtime-derived key to PostHogProvider as apiKey."
  );
  // The host derived from window.__POSTHOG_HOST__ must be used in the options object passed to PostHogProvider.
  // Expected pattern: api_host: host (within the options object literal)
  assertTruthy(
    /api_host:\s*host/.test(source),
    "main.jsx must use the runtime-derived host as api_host in PostHogProvider options."
  );
  assertTruthy(
    source.includes("VITE_PUBLIC_POSTHOG_KEY"),
    "main.jsx must use VITE_PUBLIC_POSTHOG_KEY (not VITE_POSTHOG_KEY) for build-time fallback"
  );
  assertTruthy(
    source.includes("VITE_PUBLIC_POSTHOG_HOST"),
    "main.jsx must use VITE_PUBLIC_POSTHOG_HOST for build-time fallback"
  );
});

// Run and report
const results = await suite.run();
const exitCode = results.failed > 0 ? 1 : 0;
process.exit(exitCode);
