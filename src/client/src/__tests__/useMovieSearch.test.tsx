// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMovieSearch } from "../useMovieSearch";
import { showError } from "../showError";
import { showMessage } from "../showMessage";
import { captureFrontendMessage } from "../sentry";
import { jsonResponse } from "./jsonResponse";

vi.mock("../showMessage", () => ({
  showMessage: vi.fn(),
}));

vi.mock("../showError", () => ({
  showError: vi.fn(),
}));

vi.mock("../sentry", () => ({
  captureFrontendException: vi.fn(),
  captureFrontendMessage: vi.fn(),
}));

describe("useMovieSearch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows already-working message when a search is in flight", async () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    const { result } = renderHook(() => useMovieSearch());
    await act(async () => {
      result.current({ title: "First", country: "US" });
    });
    await act(async () => {
      result.current({ title: "Second", country: "US" });
    });
    expect(vi.mocked(showMessage)).toHaveBeenCalledWith("Already working on that search...");
  });

  it("shows an error toast when network request fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useMovieSearch());

    await act(async () => {
      result.current({ title: "The Matrix", year: "1999", country: "US" });
    });

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith(
        "Movie search failed. Check your connection and try again.",
      );
    });
  });

  it("shows an error toast when response cannot be parsed", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("<html>error</html>", {
        status: 500,
        headers: { "content-type": "text/html" },
      }),
    );

    const { result } = renderHook(() => useMovieSearch());

    await act(async () => {
      result.current({ title: "The Matrix", year: "1999", country: "US" });
    });

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith("Movie search failed. Please try again.");
    });
  });

  it("shows API error message and merges tile when payload contains error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        error: "Movie not found",
        title: "Unknown",
        year: "1990",
        link: "https://letterboxd.com/film/unknown/",
      }),
    );
    const mergeTile = vi.fn();
    const setShowAltSearchButton = vi.fn();
    const setMovieSearchLoading = vi.fn();
    const { result } = renderHook(() =>
      useMovieSearch(setShowAltSearchButton, setMovieSearchLoading, mergeTile),
    );

    await act(async () => {
      result.current({ title: "Unknown", year: "1990", country: "US" });
    });

    await waitFor(() => {
      expect(mergeTile).toHaveBeenCalledWith(
        "Unknown",
        "1990",
        expect.objectContaining({ link: "https://letterboxd.com/film/unknown/" }),
      );
      expect(showMessage).toHaveBeenCalledWith("[Unknown (1990)] Movie not found");
      expect(setShowAltSearchButton).toHaveBeenCalledWith(true);
      expect(setMovieSearchLoading).toHaveBeenCalledWith(true);
      expect(setMovieSearchLoading).toHaveBeenLastCalledWith(false);
    });
  });

  it("captures message when upstream returns 5xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          title: "The Matrix",
          year: "1999",
          message: "Movie found",
          movieProviders: [],
        },
        { status: 500 },
      ),
    );
    const { result } = renderHook(() => useMovieSearch());

    await act(async () => {
      result.current({ title: "The Matrix", year: "1999", country: "US" });
    });

    await waitFor(() => {
      expect(captureFrontendMessage).toHaveBeenCalledWith(
        "search-movie upstream error",
        expect.objectContaining({
          tags: expect.objectContaining({ reason: "http-5xx" }),
        }),
      );
    });
  });
});
