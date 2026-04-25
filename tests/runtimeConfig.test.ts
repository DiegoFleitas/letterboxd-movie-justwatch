/**
 * Unit tests for runtime frontend config injection and usage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPosthog, _resetPosthogForTesting } from "@server/lib/posthog.js";
import { injectRuntimeConfig } from "@server/lib/injectRuntimeConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let savedPosthogKey: string | undefined;
let savedPosthogHost: string | undefined;

beforeEach(() => {
  savedPosthogKey = process.env.POSTHOG_KEY;
  savedPosthogHost = process.env.POSTHOG_HOST;
});

afterEach(() => {
  _resetPosthogForTesting();
  if (savedPosthogKey === undefined) {
    delete process.env.POSTHOG_KEY;
  } else {
    process.env.POSTHOG_KEY = savedPosthogKey;
  }
  if (savedPosthogHost === undefined) {
    delete process.env.POSTHOG_HOST;
  } else {
    process.env.POSTHOG_HOST = savedPosthogHost;
  }
});

describe("Runtime config + PostHog", () => {
  it("getPosthog returns null when POSTHOG_KEY is unset", () => {
    _resetPosthogForTesting();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_HOST;
    expect(getPosthog()).toBeNull();
  });

  it("getPosthog returns a client when POSTHOG_KEY is set", () => {
    _resetPosthogForTesting();
    process.env.POSTHOG_KEY = "phc_test_key_placeholder";
    const result = getPosthog();
    expect(result).toBeTruthy();
    expect(typeof (result as { capture?: unknown }).capture).toBe("function");
  });

  it("getPosthog returns the same client on second call (caching)", () => {
    _resetPosthogForTesting();
    process.env.POSTHOG_KEY = "phc_test_key_placeholder";
    expect(getPosthog()).toBe(getPosthog());
  });

  it("getPosthog respects POSTHOG_HOST when set", () => {
    _resetPosthogForTesting();
    process.env.POSTHOG_KEY = "phc_test_key_placeholder";
    process.env.POSTHOG_HOST = "https://eu.i.posthog.com";
    const result = getPosthog();
    expect(result).toBeTruthy();
    expect(typeof (result as { capture?: unknown }).capture).toBe("function");
  });

  it("getPosthog returns null again after reset when key removed", () => {
    _resetPosthogForTesting();
    process.env.POSTHOG_KEY = "phc_test_key_placeholder";
    getPosthog();
    _resetPosthogForTesting();
    delete process.env.POSTHOG_KEY;
    expect(getPosthog()).toBeFalsy();
  });

  it("injectRuntimeConfig injects PostHog key and host into HTML", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const key = "phc_prod_abc123";
    const host = "https://eu.i.posthog.com";
    const result = injectRuntimeConfig(html, key, host);
    expect(result).toContain("window.__POSTHOG_KEY__");
    expect(result).toContain("window.__POSTHOG_HOST__");
    expect(result).toContain(key);
    expect(result).toContain(host);
  });

  it("injectRuntimeConfig injects Sentry globals into HTML", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const result = injectRuntimeConfig(html, "phc_key", "https://us.i.posthog.com", null, {
      dsn: "https://foo@example.ingest.sentry.io/1",
      release: "r1",
      tracesSampleRate: "0.5",
      sendDefaultPii: "true",
      environment: "production",
    });
    expect(result).toContain("window.__SENTRY_DSN__");
    expect(result).toContain("window.__SENTRY_RELEASE__");
    expect(result).toContain("window.__SENTRY_TRACES_SAMPLE_RATE__");
    expect(result).toContain("window.__SENTRY_SEND_DEFAULT_PII__");
    expect(result).toContain("window.__SENTRY_ENVIRONMENT__");
  });

  it("injectRuntimeConfig escapes key so HTML is safe", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const key = 'phc_"quoted"';
    const result = injectRuntimeConfig(html, key, "https://us.i.posthog.com");
    expect(result).toContain("__POSTHOG_KEY__");
    expect(result).toContain("phc_");
  });

  it("injectRuntimeConfig prevents </script> injection in key", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const maliciousKey = "phc_</script><script>alert(1)</script>";
    const result = injectRuntimeConfig(html, maliciousKey, "https://us.i.posthog.com");
    expect(result).not.toContain("</script><script>");
  });

  it("injectRuntimeConfig matches </HEAD> (case-insensitive)", () => {
    const htmlUpper = "<!DOCTYPE html><html><HEAD></HEAD><body></body></html>";
    const result = injectRuntimeConfig(htmlUpper, "phc_test", "https://us.i.posthog.com");
    expect(result).toContain("window.__POSTHOG_KEY__");
  });

  it("injectRuntimeConfig injects canonicalByNames when provided", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const canonicalByNames = { "HBO Max": { id: "max", name: "HBO Max" } };
    const result = injectRuntimeConfig(html, "", "https://us.i.posthog.com", canonicalByNames);
    expect(result).toContain("window.__CANONICAL_PROVIDERS_BY_NAME__");
    expect(result).toContain('"max"');
  });

  it("injectRuntimeConfig does not inject canonical when 4th arg is null/undefined", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const result = injectRuntimeConfig(html, "k", "https://us.i.posthog.com", null);
    expect(result).toContain("__POSTHOG_KEY__");
    expect(result).not.toContain("__CANONICAL_PROVIDERS_BY_NAME__");
  });

  it("frontend main.tsx reads runtime PostHog globals with VITE fallback", () => {
    const mainPath = path.join(__dirname, "..", "src", "client", "src", "main.tsx");
    const source = fs.readFileSync(mainPath, "utf8");
    expect(source).toContain("window.__POSTHOG_KEY__");
    expect(source).toContain("window.__POSTHOG_HOST__");
    expect(/PostHogProvider[^>]*apiKey=\{key\}/.test(source)).toBe(true);
    expect(/api_host:\s*host/.test(source)).toBe(true);
    expect(source).toContain('ui_host: "https://us.posthog.com"');
    expect(source).toContain("POSTHOG_PROXY_DEFAULT_PATH");
    expect(source).toContain("VITE_PUBLIC_POSTHOG_KEY");
    expect(source).toContain("VITE_PUBLIC_POSTHOG_HOST");
  });

  it("frontend sentry.ts reads runtime Sentry globals with VITE fallback", () => {
    const sentryPath = path.join(__dirname, "..", "src", "client", "src", "sentry.ts");
    const source = fs.readFileSync(sentryPath, "utf8");
    expect(source).toContain("window.__SENTRY_DSN__");
    expect(source).toContain("window.__SENTRY_RELEASE__");
    expect(source).toContain("window.__SENTRY_TRACES_SAMPLE_RATE__");
    expect(source).toContain("window.__SENTRY_SEND_DEFAULT_PII__");
    expect(source).toContain("window.__SENTRY_ENVIRONMENT__");
    expect(source).toContain("VITE_SENTRY_DSN");
  });

  it("server runtime config defaults PostHog host to first-party proxy path", () => {
    const serverConfigPath = path.join(
      __dirname,
      "..",
      "src",
      "server",
      "buildIndexHtmlForClient.ts",
    );
    const source = fs.readFileSync(serverConfigPath, "utf8");
    expect(source).toContain("POSTHOG_PROXY_DEFAULT_PATH");
  });
});
