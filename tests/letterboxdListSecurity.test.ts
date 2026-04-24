import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes.js";
import type { HttpRequestContext, HttpResponseContext } from "@server/httpContext.js";

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

  function createMockRes() {
    let statusCode = 0;
    let jsonBody: unknown;
    const res: HttpResponseContext = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        jsonBody = payload;
      },
      send() {},
      setHeader() {
        return this;
      },
    };
    return { res, getStatus: () => statusCode, getJson: () => jsonBody };
  }

  it("rejects custom list URL on watchlist endpoint before any HTTP fetch", async () => {
    const req: HttpRequestContext = {
      body: {
        username: "someone",
        listUrl: "https://letterboxd.com/someone/list/my-list/",
        listType: "custom list",
      },
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: HTTP_API_PATHS.letterboxdWatchlist,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus } = createMockRes();
    await letterboxdWatchlist({ req, res });

    expect(getStatus()).toBe(400);
    expect(mockFetchLetterboxdHtml).not.toHaveBeenCalled();
  });

  it("rejects non-Letterboxd listUrl on custom-list endpoint", async () => {
    const req: HttpRequestContext = {
      body: {
        username: "u",
        listUrl: "https://evil.com/list/",
        listType: "custom list",
      },
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: HTTP_API_PATHS.letterboxdCustomList,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus, getJson } = createMockRes();
    await letterboxdCustomList({ req, res });

    expect(getStatus()).toBe(400);
    expect((getJson() as { error?: string }).error).toBeDefined();
    expect(mockFetchLetterboxdHtml).not.toHaveBeenCalled();
  });

  it("rejects watchlist URL on custom-list endpoint", async () => {
    const req: HttpRequestContext = {
      body: {
        username: "someone",
        listUrl: "https://letterboxd.com/someone/watchlist/",
        listType: "watchlist",
      },
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: HTTP_API_PATHS.letterboxdCustomList,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus } = createMockRes();
    await letterboxdCustomList({ req, res });

    expect(getStatus()).toBe(400);
    expect(mockFetchLetterboxdHtml).not.toHaveBeenCalled();
  });

  it("rejects username mismatch for watchlist", async () => {
    const req: HttpRequestContext = {
      body: {
        username: "alice",
        listUrl: "https://letterboxd.com/bob/watchlist/",
        listType: "watchlist",
      },
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: HTTP_API_PATHS.letterboxdWatchlist,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus } = createMockRes();
    await letterboxdWatchlist({ req, res });

    expect(getStatus()).toBe(400);
    expect(mockFetchLetterboxdHtml).not.toHaveBeenCalled();
  });
});
