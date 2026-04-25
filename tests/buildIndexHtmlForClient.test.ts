import fs from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildIndexHtmlForClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns null when client dist index.html is not on disk", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const { buildIndexHtmlForClient } = await import("@server/buildIndexHtmlForClient.js");
    expect(buildIndexHtmlForClient()).toBeNull();
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
});
