// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLetterboxdList } from "../useLetterboxdList";
import { showError, showBatchErrors } from "../showError";
import { toggleNotice } from "../noticeFunctions";
import { captureFrontendException } from "../sentry";
import { HTTP_API_PATHS } from "@server/routes";
import { PLACEHOLDER_POSTER } from "../movieTiles";

vi.mock("../showError", () => ({
  showError: vi.fn(),
  showBatchErrors: vi.fn(),
}));

vi.mock("../noticeFunctions", () => ({
  toggleNotice: vi.fn(),
  setNoticeImpl: vi.fn(),
}));

vi.mock("../showMessage", () => ({
  showMessage: vi.fn(),
  plainText: (s: unknown) => String(s ?? ""),
}));

vi.mock("../sentry", () => ({
  captureFrontendException: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const watchlistUrl = "https://letterboxd.com/test-user/watchlist/";
const customListUrl = "https://letterboxd.com/test-user/list/my-list/";

describe("useLetterboxdList coverage", () => {
  const mockedShowError = vi.mocked(showError);
  const mockedShowBatchErrors = vi.mocked(showBatchErrors);
  const mockedToggleNotice = vi.mocked(toggleNotice);
  const mockedCapture = vi.mocked(captureFrontendException);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows error for empty or whitespace list URL", async () => {
    const setListLoading = vi.fn();
    const { result } = renderHook(() => useLetterboxdList(vi.fn(), setListLoading, null));

    await act(async () => {
      await result.current("   ", "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith("Please enter a valid Letterboxd list URL");
    expect(setListLoading).toHaveBeenCalledWith(true);
    expect(setListLoading).toHaveBeenLastCalledWith(false);
  });

  it("shows error for invalid Letterboxd list URL", async () => {
    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    await act(async () => {
      await result.current("https://example.com/not-letterboxd", "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith(
      "Invalid Letterboxd list URL. Use a watchlist or custom list URL.",
    );
  });

  it("shows error when watchlist API returns error field", async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdWatchlist)) {
        return Promise.resolve(
          jsonResponse({
            error: "List scrape failed",
            watchlist: [],
            lastPage: 1,
            totalPages: 1,
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    await act(async () => {
      await result.current(watchlistUrl, "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith("List scrape failed");
    expect(mockedShowBatchErrors).not.toHaveBeenCalled();
  });

  it("shows error when custom list response is not ok", async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdCustomList)) {
        return Promise.resolve(jsonResponse({ error: "bad list" }, 404));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    await act(async () => {
      await result.current(customListUrl, "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith("bad list");
  });

  it("shows error when custom list returns empty watchlist", async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdCustomList)) {
        return Promise.resolve(
          jsonResponse({
            watchlist: [],
            lastPage: 1,
            totalPages: 1,
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    await act(async () => {
      await result.current(customListUrl, "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith("No films found on this list.");
  });

  it("loads custom list and completes search batch", async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdCustomList)) {
        return Promise.resolve(
          jsonResponse({
            watchlist: [
              {
                title: "Custom Film",
                year: "2021",
                link: "https://letterboxd.com/film/custom-film/",
              },
            ],
            lastPage: 1,
            totalPages: 1,
          }),
        );
      }
      if (url.includes(HTTP_API_PATHS.searchMovie)) {
        return Promise.resolve(
          jsonResponse({
            title: "Custom Film",
            year: "2021",
            poster: PLACEHOLDER_POSTER,
            link: "https://letterboxd.com/film/custom-film/",
            movieProviders: [],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const mergeTile = vi.fn();
    const { result } = renderHook(() => useLetterboxdList(mergeTile, undefined, null));

    await act(async () => {
      await result.current(customListUrl, "US");
    });

    expect(mergeTile).toHaveBeenCalled();
    expect(mockedShowBatchErrors).toHaveBeenCalledTimes(1);
    expect(mockedShowBatchErrors).toHaveBeenCalledWith([]);
    expect(mockedToggleNotice).toHaveBeenCalled();
  });

  it("shows timeout error when watchlist fetch aborts", async () => {
    const abortErr = new DOMException("The operation was aborted.", "AbortError");
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdWatchlist)) {
        return Promise.reject(abortErr);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    await act(async () => {
      await result.current(watchlistUrl, "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith(
      "Request timed out while loading the list. Try again with a valid Letterboxd URL.",
    );
    expect(mockedToggleNotice).toHaveBeenCalledWith(null);
    expect(mockedCapture).toHaveBeenCalledWith(
      abortErr,
      expect.objectContaining({
        tags: expect.objectContaining({
          reason: "timeout",
          endpoint: HTTP_API_PATHS.letterboxdWatchlist,
        }),
      }),
    );
  });

  it("shows timeout error when custom-list fetch aborts", async () => {
    const abortErr = new DOMException("The operation was aborted.", "AbortError");
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdCustomList)) {
        return Promise.reject(abortErr);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    await act(async () => {
      await result.current(customListUrl, "US");
    });

    expect(mockedShowError).toHaveBeenCalledWith(
      "Request timed out while loading the list. Try again with a valid Letterboxd URL.",
    );
    expect(mockedToggleNotice).toHaveBeenCalledWith(null);
    expect(mockedCapture).toHaveBeenCalledWith(
      abortErr,
      expect.objectContaining({
        tags: expect.objectContaining({
          reason: "timeout",
          endpoint: HTTP_API_PATHS.letterboxdCustomList,
        }),
      }),
    );
  });

  it("shows Already working when a second load starts before the first finishes", async () => {
    let resolveWatchlist!: (value: Response) => void;
    const watchlistPending = new Promise<Response>((res) => {
      resolveWatchlist = res;
    });

    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(HTTP_API_PATHS.letterboxdWatchlist)) {
        return watchlistPending;
      }
      if (url.includes(HTTP_API_PATHS.searchMovie)) {
        return Promise.resolve(
          jsonResponse({
            title: "X",
            year: "2020",
            poster: PLACEHOLDER_POSTER,
            link: "",
            movieProviders: [],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLetterboxdList(vi.fn(), undefined, null));

    let firstLoad: Promise<void>;
    await act(() => {
      firstLoad = result.current(watchlistUrl, "US");
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await result.current(watchlistUrl, "US");
    });

    expect(mockedToggleNotice).toHaveBeenCalledWith("Already working on that list...");

    await act(async () => {
      resolveWatchlist!(
        jsonResponse({
          watchlist: [{ title: "X", year: "2020", link: "https://letterboxd.com/film/x/" }],
          lastPage: 1,
          totalPages: 1,
        }),
      );
      await firstLoad!;
    });
  });
});
