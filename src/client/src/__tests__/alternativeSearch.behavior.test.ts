// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jsonResponse } from "./jsonResponse";

const showMessage = vi.fn();
const showError = vi.fn();
const toggleNotice = vi.fn();
const captureFrontendException = vi.fn();
const captureFrontendMessage = vi.fn();

vi.mock("../showMessage", () => ({ showMessage }));
vi.mock("../showError", () => ({ showError }));
vi.mock("../noticeFunctions", () => ({ toggleNotice }));
vi.mock("../sentry", () => ({
  captureFrontendException,
  captureFrontendMessage,
}));

describe("runAlternativeSearch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when title is empty", async () => {
    const { runAlternativeSearch } = await import("../alternativeSearch");
    runAlternativeSearch("");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows message when a search is already in flight", async () => {
    const { runAlternativeSearch } = await import("../alternativeSearch");
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    runAlternativeSearch("A");
    runAlternativeSearch("B");
    expect(showMessage).toHaveBeenCalledWith("Already working on torrent search...");
  });

  it("shows success toast with link payload", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ text: "found", url: "https://x", title: "A" }),
    );
    const { runAlternativeSearch } = await import("../alternativeSearch");
    const setLoading = vi.fn();
    runAlternativeSearch("A", 2000, { setAlternativeSearchLoading: setLoading });
    await vi.waitFor(() => expect(showMessage).toHaveBeenCalled());
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("shows error when fetch rejects", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network"));
    const { runAlternativeSearch } = await import("../alternativeSearch");
    runAlternativeSearch("T");
    await vi.waitFor(() => expect(showError).toHaveBeenCalledWith("Alternative search failed."));
    expect(captureFrontendException).toHaveBeenCalled();
  });

  it("records upstream errors for 5xx responses", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "x" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { runAlternativeSearch } = await import("../alternativeSearch");
    runAlternativeSearch("T");
    await vi.waitFor(() => expect(captureFrontendMessage).toHaveBeenCalled());
  });
});

describe("searchSubs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when query empty", async () => {
    const { searchSubs } = await import("../alternativeSearch");
    searchSubs("");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("opens window when subtitles url returned", async () => {
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ url: "https://subdl.com/x" }));
    const { searchSubs } = await import("../alternativeSearch");
    searchSubs("Film");
    await vi.waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        "https://subdl.com/x",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });

  it("shows error when API returns error", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ error: "nope" }));
    const { searchSubs } = await import("../alternativeSearch");
    searchSubs("Film");
    await vi.waitFor(() => expect(showError).toHaveBeenCalledWith("nope"));
  });

  it("shows error when subtitles fetch rejects", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("down"));
    const { searchSubs } = await import("../alternativeSearch");
    searchSubs("Film");
    await vi.waitFor(() => expect(showError).toHaveBeenCalledWith("Failed to search subtitles."));
    expect(captureFrontendException).toHaveBeenCalled();
  });
});
