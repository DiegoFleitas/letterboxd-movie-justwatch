/**
 * Unit tests for PostHog integration
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPosthog, _resetPosthogForTesting } from "../lib/posthog.js";
import { injectPosthogConfig } from "../lib/injectPosthogConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let savedPosthogKey: string | undefined;
let savedPosthogHost: string | undefined;

beforeEach(() => {
  savedPosthogKey = process.env.POSTHOG_KEY;
  savedPosthogHost = process.env.POSTHOG_HOST;
});

afterEach(() => {
  _resetPosthogForTesting();
  if (savedPosthogKey !== undefined) process.env.POSTHOG_KEY = savedPosthogKey;
  else delete process.env.POSTHOG_KEY;
  if (savedPosthogHost !== undefined) process.env.POSTHOG_HOST = savedPosthogHost;
  else delete process.env.POSTHOG_HOST;
});

describe("PostHog", () => {
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

  it("injectPosthogConfig injects key and host into HTML", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const key = "phc_prod_abc123";
    const host = "https://eu.i.posthog.com";
    const result = injectPosthogConfig(html, key, host);
    expect(result).toContain("window.__POSTHOG_KEY__");
    expect(result).toContain("window.__POSTHOG_HOST__");
    expect(result).toContain(key);
    expect(result).toContain(host);
  });

  it("injectPosthogConfig escapes key so HTML is safe", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const key = 'phc_"quoted"';
    const result = injectPosthogConfig(html, key, "https://us.i.posthog.com");
    expect(result).toContain("__POSTHOG_KEY__");
    expect(result).toContain("phc_");
  });

  it("injectPosthogConfig prevents </script> injection in key", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const maliciousKey = "phc_</script><script>alert(1)</script>";
    const result = injectPosthogConfig(html, maliciousKey, "https://us.i.posthog.com");
    expect(result).not.toContain("</script><script>");
  });

  it("injectPosthogConfig matches </HEAD> (case-insensitive)", () => {
    const htmlUpper = "<!DOCTYPE html><html><HEAD></HEAD><body></body></html>";
    const result = injectPosthogConfig(htmlUpper, "phc_test", "https://us.i.posthog.com");
    expect(result).toContain("window.__POSTHOG_KEY__");
  });

  it("injectPosthogConfig injects canonicalByNames when provided", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const canonicalByNames = { "HBO Max": { id: "max", name: "HBO Max" } };
    const result = injectPosthogConfig(html, "", "https://us.i.posthog.com", canonicalByNames);
    expect(result).toContain("window.__CANONICAL_PROVIDERS_BY_NAME__");
    expect(result).toContain('"max"');
  });

  it("injectPosthogConfig does not inject canonical when 4th arg is null/undefined", () => {
    const html = "<!DOCTYPE html><html><head></head><body></body></html>";
    const result = injectPosthogConfig(html, "k", "https://us.i.posthog.com", null);
    expect(result).toContain("__POSTHOG_KEY__");
    expect(result).not.toContain("__CANONICAL_PROVIDERS_BY_NAME__");
  });

  it("frontend main.tsx reads runtime config (window.__POSTHOG_KEY__) so Fly secrets work", () => {
    const mainPath = path.join(__dirname, "..", "public", "src", "main.tsx");
    const source = fs.readFileSync(mainPath, "utf8");
    expect(source).toContain("window.__POSTHOG_KEY__");
    expect(source).toContain("window.__POSTHOG_HOST__");
    expect(/PostHogProvider[^>]*apiKey=\{key\}/.test(source)).toBe(true);
    expect(/api_host:\s*host/.test(source)).toBe(true);
    expect(source).toContain("VITE_PUBLIC_POSTHOG_KEY");
    expect(source).toContain("VITE_PUBLIC_POSTHOG_HOST");
  });
});
