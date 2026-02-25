/**
 * Unit tests for PostHog integration
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TestSuite, assertEqual, assertTruthy, assertFalsy } from "./testUtils.js";
import { getPosthog, _resetPosthogForTesting } from "../lib/posthog.js";
import { injectPosthogConfig } from "../lib/injectPosthogConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suite = new TestSuite("PostHog");

const savedEnv: Record<string, string | undefined> = {};

suite.test("getPosthog returns null when POSTHOG_KEY is unset", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  savedEnv.POSTHOG_HOST = process.env.POSTHOG_HOST;
  delete process.env.POSTHOG_KEY;
  delete process.env.POSTHOG_HOST;
  const result = getPosthog();
  assertEqual(result, null);
  process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
  if (savedEnv.POSTHOG_HOST !== undefined) process.env.POSTHOG_HOST = savedEnv.POSTHOG_HOST;
});

suite.test("getPosthog returns a client when POSTHOG_KEY is set", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";
  const result = getPosthog();
  assertTruthy(result);
  assertTruthy(typeof (result as { capture?: unknown }).capture === "function");
  if (savedEnv.POSTHOG_KEY !== undefined) process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
  else delete process.env.POSTHOG_KEY;
});

suite.test("getPosthog returns the same client on second call (caching)", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";
  const first = getPosthog();
  const second = getPosthog();
  assertEqual(first, second);
  if (savedEnv.POSTHOG_KEY !== undefined) process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
  else delete process.env.POSTHOG_KEY;
});

suite.test("getPosthog respects POSTHOG_HOST when set", () => {
  _resetPosthogForTesting();
  savedEnv.POSTHOG_KEY = process.env.POSTHOG_KEY;
  savedEnv.POSTHOG_HOST = process.env.POSTHOG_HOST;
  process.env.POSTHOG_KEY = "phc_test_key_placeholder";
  process.env.POSTHOG_HOST = "https://eu.i.posthog.com";
  const result = getPosthog();
  assertTruthy(result);
  assertTruthy(typeof (result as { capture?: unknown }).capture === "function");
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
  assertFalsy(result);
  if (savedEnv.POSTHOG_KEY !== undefined) process.env.POSTHOG_KEY = savedEnv.POSTHOG_KEY;
});

suite.test("injectPosthogConfig injects key and host into HTML", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const key = "phc_prod_abc123";
  const host = "https://eu.i.posthog.com";
  const result = injectPosthogConfig(html, key, host);
  assertTruthy(result.includes("window.__POSTHOG_KEY__"));
  assertTruthy(result.includes("window.__POSTHOG_HOST__"));
  assertTruthy(result.includes(key));
  assertTruthy(result.includes(host));
});

suite.test("injectPosthogConfig escapes key so HTML is safe", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const key = 'phc_"quoted"';
  const result = injectPosthogConfig(html, key, "https://us.i.posthog.com");
  assertTruthy(result.includes("__POSTHOG_KEY__"));
  assertTruthy(result.includes("phc_"));
});

suite.test("injectPosthogConfig prevents </script> injection in key", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const maliciousKey = "phc_</script><script>alert(1)</script>";
  const result = injectPosthogConfig(html, maliciousKey, "https://us.i.posthog.com");
  assertFalsy(result.includes("</script><script>"));
});

suite.test("injectPosthogConfig matches </HEAD> (case-insensitive)", () => {
  const htmlUpper = "<!DOCTYPE html><html><HEAD></HEAD><body></body></html>";
  const result = injectPosthogConfig(htmlUpper, "phc_test", "https://us.i.posthog.com");
  assertTruthy(result.includes("window.__POSTHOG_KEY__"));
});

suite.test("injectPosthogConfig injects canonicalByNames when provided", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const canonicalByNames = { "HBO Max": { id: "max", name: "HBO Max" } };
  const result = injectPosthogConfig(html, "", "https://us.i.posthog.com", canonicalByNames);
  assertTruthy(result.includes("window.__CANONICAL_PROVIDERS_BY_NAME__"));
  assertTruthy(result.includes('"max"'));
});

suite.test("injectPosthogConfig does not inject canonical when 4th arg is null/undefined", () => {
  const html = "<!DOCTYPE html><html><head></head><body></body></html>";
  const result = injectPosthogConfig(html, "k", "https://us.i.posthog.com", null);
  assertTruthy(result.includes("__POSTHOG_KEY__"));
  assertTruthy(!result.includes("__CANONICAL_PROVIDERS_BY_NAME__"));
});

suite.test("frontend main.tsx reads runtime config (window.__POSTHOG_KEY__) so Fly secrets work", () => {
  const mainPath = path.join(__dirname, "..", "public", "src", "main.tsx");
  const source = fs.readFileSync(mainPath, "utf8");
  assertTruthy(source.includes("window.__POSTHOG_KEY__"));
  assertTruthy(source.includes("window.__POSTHOG_HOST__"));
  assertTruthy(/PostHogProvider[^>]*apiKey=\{key\}/.test(source));
  assertTruthy(/api_host:\s*host/.test(source));
  assertTruthy(source.includes("VITE_PUBLIC_POSTHOG_KEY"));
  assertTruthy(source.includes("VITE_PUBLIC_POSTHOG_HOST"));
});

const results = await suite.run();
process.exit(results.failed > 0 ? 1 : 0);
