import { describe, expect, it } from "vitest";
import { POSTHOG_PROXY_DEFAULT_PATH as SHARED_POSTHOG_PROXY_DEFAULT_PATH } from "../src/shared/posthog-routes.js";
import {
  HTTP_API_PATHS,
  POSTHOG_PROXY_DEFAULT_PATH,
  posthogProxyTargetFromRequestUrl,
  proxyTargetFromRequestUrl,
} from "@server/routes.js";

describe("server/routes", () => {
  it("proxyTargetFromRequestUrl strips the proxy mount prefix", () => {
    expect(
      proxyTargetFromRequestUrl(
        `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/search/movie?q=1`,
      ),
    ).toBe("https://api.themoviedb.org/3/search/movie?q=1");
  });

  it("proxyTargetFromRequestUrl uses replace semantics for the first prefix occurrence", () => {
    expect(
      proxyTargetFromRequestUrl(
        `${HTTP_API_PATHS.proxyPrefix}/https://example.com${HTTP_API_PATHS.proxyPrefix}/resource`,
      ),
    ).toBe(`https://example.com${HTTP_API_PATHS.proxyPrefix}/resource`);
  });

  it("defines a non-obvious first-party PostHog proxy path", () => {
    expect(POSTHOG_PROXY_DEFAULT_PATH).toMatch(/^\/[a-z0-9-]+$/);
    expect(["/analytics", "/tracking", "/posthog"]).not.toContain(POSTHOG_PROXY_DEFAULT_PATH);
  });

  it("keeps server PostHog proxy path in sync with shared constant", () => {
    expect(POSTHOG_PROXY_DEFAULT_PATH).toBe(SHARED_POSTHOG_PROXY_DEFAULT_PATH);
    expect(HTTP_API_PATHS.posthogProxyPrefix).toBe(SHARED_POSTHOG_PROXY_DEFAULT_PATH);
  });

  it("posthogProxyTargetFromRequestUrl strips PostHog proxy prefix", () => {
    expect(
      posthogProxyTargetFromRequestUrl(`${HTTP_API_PATHS.posthogProxyPrefix}/e/?ip=1&_=123`),
    ).toBe("/e/?ip=1&_=123");
  });
});
