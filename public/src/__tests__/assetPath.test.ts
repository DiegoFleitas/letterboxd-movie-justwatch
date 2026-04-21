import { describe, expect, it } from "vitest";
import { getPublicAssetPath } from "../assetPath";

describe("getPublicAssetPath", () => {
  it("prefixes icon paths with BASE_URL when app is deployed under a subpath", () => {
    expect(getPublicAssetPath("icons/alternative-search.svg", "/movie-app/")).toBe(
      "/movie-app/icons/alternative-search.svg",
    );
  });

  it("keeps root-based paths stable when BASE_URL is root", () => {
    expect(getPublicAssetPath("icons/alternative-search.svg", "/")).toBe(
      "/icons/alternative-search.svg",
    );
  });
});
