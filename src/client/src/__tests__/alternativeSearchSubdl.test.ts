// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes";
import { runAlternativeSearch, searchSubs } from "../alternativeSearch";

vi.mock("../showError", () => ({
  showError: vi.fn(),
}));

vi.mock("../sentry", () => ({
  captureFrontendException: vi.fn(),
}));

import { showError } from "../showError";

describe("searchSubs", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not call fetch when query is empty", () => {
    searchSubs("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens returned url in a new tab on success", async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ url: "https://subdl.com/subtitle/sd1/x" }),
    });
    searchSubs("Inception", 2010);
    await vi.waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        "https://subdl.com/subtitle/sd1/x",
        "_blank",
        "noopener,noreferrer",
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      HTTP_API_PATHS.subdlSearch,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Inception", year: 2010 }),
      }),
    );
  });

  it("shows error when API returns error", async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ error: "No luck" }),
    });
    searchSubs("Nope");
    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith("No luck");
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it("shows default error when url is missing", async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({}),
    });
    searchSubs("Nope");
    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith("No subtitles found.");
    });
  });

  it("shows failure message when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    searchSubs("Nope");
    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith("Failed to search subtitles.");
    });
  });
});

describe("runAlternativeSearch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows failure message when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network"));

    runAlternativeSearch("Inception", 2010);

    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith("Alternative search failed.");
    });
  });
});
