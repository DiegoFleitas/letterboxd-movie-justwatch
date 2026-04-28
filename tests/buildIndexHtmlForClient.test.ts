import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POSTHOG_PROXY_DEFAULT_PATH as SHARED_POSTHOG_PROXY_DEFAULT_PATH } from "../src/shared/posthog-routes.js";
import { POSTHOG_PROXY_DEFAULT_PATH } from "@server/routes.js";

describe("buildIndexHtmlForClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns null when client dist index.html is not on disk", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const { buildIndexHtmlForClient } = await import("@server/buildIndexHtmlForClient.js");
    expect(buildIndexHtmlForClient()).toBeNull();
  });

  it("uses the same PostHog proxy constant as shared config", () => {
    expect(POSTHOG_PROXY_DEFAULT_PATH).toBe(SHARED_POSTHOG_PROXY_DEFAULT_PATH);
  });

  it("reads index.html and passes buffer through injectRuntimeConfig when present", async () => {
    vi.doMock("@server/lib/injectRuntimeConfig.js", () => ({
      injectRuntimeConfig: () => "<html>injected</html>",
    }));
    vi.doMock("@server/lib/loadCanonicalProviders.js", () => ({
      getCanonicalProviderByNames: () => ({ providers: [] }),
    }));
    vi.resetModules();
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("<html>raw</html>");

    const { buildIndexHtmlForClient } = await import("@server/buildIndexHtmlForClient.js");
    expect(buildIndexHtmlForClient()).toBe("<html>injected</html>");
    expect(fs.readFileSync).toHaveBeenCalled();
  });

  it("falls back to first-party proxy when POSTHOG_HOST points to posthog.com", async () => {
    const injectRuntimeConfig = vi.fn(() => "<html>injected</html>");
    vi.doMock("@server/lib/injectRuntimeConfig.js", () => ({
      injectRuntimeConfig,
    }));
    vi.doMock("@server/lib/loadCanonicalProviders.js", () => ({
      getCanonicalProviderByNames: () => null,
    }));
    vi.stubEnv("POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("POSTHOG_HOST", "https://us.i.posthog.com");
    vi.resetModules();
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("<html>raw</html>");

    const { buildIndexHtmlForClient } = await import("@server/buildIndexHtmlForClient.js");
    expect(buildIndexHtmlForClient()).toBe("<html>injected</html>");
    expect(injectRuntimeConfig).toHaveBeenCalledWith(
      "<html>raw</html>",
      "phc_test_key",
      POSTHOG_PROXY_DEFAULT_PATH,
      null,
      expect.any(Object),
    );
  });
});
