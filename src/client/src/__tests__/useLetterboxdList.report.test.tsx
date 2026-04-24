// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCallback, useRef } from "react";
import { useLetterboxdList } from "../useLetterboxdList";
import { PLACEHOLDER_POSTER, type TileData } from "../movieTiles";
import { NO_POSTER_REPORT_DELAY_MS } from "../animation/timing";
import { listReportToastCopy } from "../githubIssueUrl";
import { showMessage } from "../showMessage";
import {
  createListAndSearchFetchMock,
  useLetterboxdListWithMergedTiles,
  watchlistUrl,
} from "./test-utils/useLetterboxdListHarness.js";

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

describe("useLetterboxdList GitHub nudge (45s timer)", () => {
  const mockedShowMessage = vi.mocked(showMessage);

  beforeEach(() => {
    vi.useFakeTimers();
    mockedShowMessage.mockClear();
    globalThis.fetch = createListAndSearchFetchMock({
      listBody: {
        watchlist: [
          { title: "Test Film", year: "2020", link: "https://letterboxd.com/film/test-film-2020/" },
        ],
        lastPage: 1,
        totalPages: 1,
      },
      searchBody: {
        title: "Test Film",
        year: 2020,
        poster: PLACEHOLDER_POSTER,
        link: "https://letterboxd.com/film/test-film-2020/",
        movieProviders: [],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("after 45s calls showMessage when all posters are still placeholders", async () => {
    const { result } = renderHook(() => useLetterboxdListWithMergedTiles());

    await act(async () => {
      await result.current(watchlistUrl, "US");
    });

    expect(mockedShowMessage).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NO_POSTER_REPORT_DELAY_MS);
    });

    expect(mockedShowMessage).toHaveBeenCalledTimes(1);
    expect(mockedShowMessage).toHaveBeenCalledWith(
      {
        text: listReportToastCopy("all_placeholder_posters"),
        url: expect.stringMatching(/\/issues\/new\?/),
      },
      true,
    );
    const arg = mockedShowMessage.mock.calls[0][0] as { url?: string };
    expect(arg.url).toMatch(/issues\/new\?/);
  });

  it("after 45s calls showMessage when mergeTile left no tiles in ref", async () => {
    const { result } = renderHook(() => {
      const listMovieTilesRef = useRef<Record<string, TileData>>({});
      const mergeTileNoop = useCallback(() => {
        /* keep listMovieTilesRef empty */
      }, []);
      return useLetterboxdList(mergeTileNoop, undefined, listMovieTilesRef);
    });

    await act(async () => {
      await result.current(watchlistUrl, "US");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NO_POSTER_REPORT_DELAY_MS);
    });

    expect(mockedShowMessage).toHaveBeenCalledTimes(1);
    expect(mockedShowMessage).toHaveBeenCalledWith(
      {
        text: listReportToastCopy("no_tiles"),
        url: expect.stringMatching(/\/issues\/new\?/),
      },
      true,
    );
    const arg = mockedShowMessage.mock.calls[0][0] as { url?: string };
    expect(arg.url).toMatch(/issues\/new\?/);
  });

  it("does not call showMessage before 45s", async () => {
    const { result } = renderHook(() => useLetterboxdListWithMergedTiles());

    await act(async () => {
      await result.current(watchlistUrl, "US");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NO_POSTER_REPORT_DELAY_MS - 1);
    });

    expect(mockedShowMessage).not.toHaveBeenCalled();
  });
});
