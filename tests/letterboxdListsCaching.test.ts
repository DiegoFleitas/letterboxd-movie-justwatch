import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes";
import type { HttpRequestContext, HttpResponseContext } from "@server/httpContext.js";

const { mockFetchLetterboxdHtml, mockGetCacheValue, mockSetCacheValue } = vi.hoisted(() => ({
  mockFetchLetterboxdHtml: vi.fn(),
  mockGetCacheValue: vi.fn(),
  mockSetCacheValue: vi.fn().mockResolvedValue(true),
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
  getCacheValue: mockGetCacheValue,
  setCacheValue: mockSetCacheValue,
  indexCacheKeyByCategory: vi.fn().mockResolvedValue(true),
}));

import { letterboxdWatchlist } from "@server/controllers/letterboxdLists.js";

describe("letterboxdLists Redis caching", () => {
  beforeEach(() => {
    mockFetchLetterboxdHtml.mockReset();
    mockGetCacheValue.mockReset();
    mockSetCacheValue.mockReset();
    mockGetCacheValue.mockResolvedValue(null);
    mockSetCacheValue.mockResolvedValue(true);
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

  it("caches an empty array for later pages after total is known (pagination tail)", async () => {
    const page1Html = `
      <html><body>
        <h1 class="section-heading">u wants to see 5 films</h1>
        <ul class="grid">
          <li class="griditem"><div data-target-link="/film/foo-2020/"><img alt="Foo"/></div></li>
        </ul>
      </body></html>`;
    const page2Html = `<html><body><h1 class="section-heading">u wants to see 5 films</h1></body></html>`;

    mockFetchLetterboxdHtml.mockImplementation((url: string) => {
      if (url.includes("/page/1/")) return Promise.resolve(page1Html);
      if (url.includes("/page/2/")) return Promise.resolve(page2Html);
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });

    const req: HttpRequestContext = {
      body: {
        username: "u",
        listUrl: "https://letterboxd.com/u/watchlist/",
        listType: "watchlist",
        page: 1,
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

    expect(getStatus()).toBe(200);
    const emptyTailCall = mockSetCacheValue.mock.calls.find(
      (args) =>
        args[0] === "watchlist:u_watchlist:page:2" &&
        Array.isArray(args[1]) &&
        args[1].length === 0,
    );
    expect(emptyTailCall).toBeDefined();
  });
});
