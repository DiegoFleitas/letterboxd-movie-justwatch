import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes.js";
import {
  createHttpMockResponse,
  createLetterboxdRequest,
} from "./helpers/letterboxdRequestTestUtils.js";

const { mockFetchLetterboxdHtml } = vi.hoisted(() => ({
  mockFetchLetterboxdHtml: vi.fn(),
}));

vi.mock("@server/lib/letterboxdHttp.js", () => ({
  LetterboxdHttpError: class LetterboxdHttpError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "LetterboxdHttpError";
      this.status = status;
    }
  },
  fetchLetterboxdHtml: mockFetchLetterboxdHtml,
  fetchLetterboxdBinaryOk: vi.fn(),
  buildLetterboxdHtmlRequestHeaders: (ua: string) => ({
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml",
  }),
  buildLetterboxdImageRequestHeaders: (ua: string) => ({
    "User-Agent": ua,
    Accept: "image/*",
  }),
}));

vi.mock("@server/lib/redis.js", () => ({
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
}));

import { letterboxdWatchlist, letterboxdCustomList } from "@server/controllers/letterboxdLists.js";

describe("letterboxd list URL validation (SSRF guard)", () => {
  beforeEach(() => {
    mockFetchLetterboxdHtml.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: "rejects custom list URL on watchlist endpoint before any HTTP fetch",
      body: {
        username: "someone",
        listUrl: "https://letterboxd.com/someone/list/my-list/",
        listType: "custom list",
      },
      endpoint: HTTP_API_PATHS.letterboxdWatchlist,
      handler: letterboxdWatchlist,
      expectErrorBody: false,
    },
    {
      name: "rejects non-Letterboxd listUrl on custom-list endpoint",
      body: {
        username: "u",
        listUrl: "https://evil.com/list/",
        listType: "custom list",
      },
      endpoint: HTTP_API_PATHS.letterboxdCustomList,
      handler: letterboxdCustomList,
      expectErrorBody: true,
    },
    {
      name: "rejects watchlist URL on custom-list endpoint",
      body: {
        username: "someone",
        listUrl: "https://letterboxd.com/someone/watchlist/",
        listType: "watchlist",
      },
      endpoint: HTTP_API_PATHS.letterboxdCustomList,
      handler: letterboxdCustomList,
      expectErrorBody: false,
    },
    {
      name: "rejects username mismatch for watchlist",
      body: {
        username: "alice",
        listUrl: "https://letterboxd.com/bob/watchlist/",
        listType: "watchlist",
      },
      endpoint: HTTP_API_PATHS.letterboxdWatchlist,
      handler: letterboxdWatchlist,
      expectErrorBody: false,
    },
  ])("$name", async ({ body, endpoint, handler, expectErrorBody }) => {
    const req = createLetterboxdRequest(body, endpoint);
    const { res, getStatus, getJson } = createHttpMockResponse();
    await handler({ req, res });
    expect(getStatus()).toBe(400);
    if (expectErrorBody) {
      expect((getJson() as { error?: string }).error).toBeDefined();
    }
    expect(mockFetchLetterboxdHtml).not.toHaveBeenCalled();
  });
});
