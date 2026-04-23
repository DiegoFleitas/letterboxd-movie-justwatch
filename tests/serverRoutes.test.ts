import { describe, expect, it } from "vitest";
import { HTTP_API_PATHS, proxyTargetFromRequestUrl } from "@server/routes";

describe("server/routes", () => {
  it("proxyTargetFromRequestUrl strips the proxy mount prefix", () => {
    expect(
      proxyTargetFromRequestUrl(
        `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/search/movie?q=1`,
      ),
    ).toBe("https://api.themoviedb.org/3/search/movie?q=1");
  });

  it("proxyTargetFromRequestUrl uses replace semantics for the first prefix occurrence", () => {
    expect(proxyTargetFromRequestUrl("")).toBe("");
  });
});
