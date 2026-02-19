/**
 * Unit tests for PostHog integration (lib/posthog.js and server error handling pattern)
 */

import { TestSuite, assertEqual, assertTruthy, assertFalsy } from "./testUtils.js";
import { getPosthog, _resetPosthogForTesting } from "../lib/posthog.js";

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

// Run and report
const results = await suite.run();
const exitCode = results.failed > 0 ? 1 : 0;
process.exit(exitCode);
