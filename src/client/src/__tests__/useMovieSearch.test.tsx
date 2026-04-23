// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMovieSearch } from "../useMovieSearch";
import { showError } from "../showError";

vi.mock("../showMessage", () => ({
  showMessage: vi.fn(),
}));

vi.mock("../showError", () => ({
  showError: vi.fn(),
}));

describe("useMovieSearch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
});
