import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "@server/httpStatusCodes.js";
import type { HttpHandler, HttpHandlerArgs } from "@server/httpContext.js";
import { LetterboxdHttpError } from "@server/lib/letterboxdHttp.js";

const fetchBinaryMock = vi.fn();

vi.mock("@server/lib/letterboxdHttp.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@server/lib/letterboxdHttp.js")>();
  return {
    ...mod,
    fetchLetterboxdBinaryOk: (...args: Parameters<typeof mod.fetchLetterboxdBinaryOk>) =>
      fetchBinaryMock(...args),
  };
});

const redisMocks = vi.hoisted(() => ({
  getCacheValue: vi.fn(),
  setCacheValue: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@server/lib/redis.js", () => ({
  getCacheValue: (...a: unknown[]) => redisMocks.getCacheValue(...(a as [])),
  setCacheValue: (...a: unknown[]) => redisMocks.setCacheValue(...(a as [])),
}));

const sentryMocks = vi.hoisted(() => ({
  getClient: vi.fn(() => null),
  captureException: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  getClient: () => sentryMocks.getClient(),
  captureException: (...a: unknown[]) => sentryMocks.captureException(...a),
}));

type MockRes = {
  json: (payload: unknown) => void;
  jsonMock: ReturnType<typeof vi.fn>;
  statusCode: number | undefined;
  status: (code: number) => MockRes;
  send: (payload?: unknown) => void;
  setHeader: (name: string, value: string | number | readonly string[]) => MockRes;
};

function mockRes(): MockRes {
  const jsonMock = vi.fn();
  const self: MockRes = {
    json: jsonMock,
    jsonMock,
    statusCode: undefined,
    status(code: number) {
      self.statusCode = code;
      return self;
    },
    send: vi.fn(),
    setHeader() {
      return self;
    },
  };
  return self;
}

type HandlerCtx = Omit<HttpHandlerArgs, "res"> & { res: MockRes };

function ctx(body: unknown): HandlerCtx {
  const res = mockRes();
  return {
    req: {
      body,
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: "/api/letterboxd-poster",
      cookies: {},
      session: {},
      appLocals: {},
    },
    res,
  };
}

describe("letterboxdPoster controller", () => {
  let letterboxdPoster: HttpHandler;

  beforeEach(async () => {
    fetchBinaryMock.mockReset();
    redisMocks.getCacheValue.mockReset();
    redisMocks.setCacheValue.mockReset();
    sentryMocks.getClient.mockReturnValue(null);
    sentryMocks.captureException.mockReset();
    ({ letterboxdPoster } = await import("@server/controllers/letterboxdPoster.js"));
  });

  it("returns 400 when filmId or filmSlug missing", async () => {
    const args = ctx({ filmId: "1" });
    await letterboxdPoster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("returns cached poster URL", async () => {
    redisMocks.getCacheValue.mockResolvedValue("https://cached-poster");
    const args = ctx({ filmId: "12345", filmSlug: "matrix-1999" });
    await letterboxdPoster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ poster: "https://cached-poster" }),
    );
    expect(fetchBinaryMock).not.toHaveBeenCalled();
  });

  it("returns 200 after successful binary fetch and caches", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    fetchBinaryMock.mockResolvedValue(undefined);
    const args = ctx({ filmId: "99", filmSlug: "test-film", cacheBustingKey: "abc" });
    await letterboxdPoster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(fetchBinaryMock).toHaveBeenCalled();
    const posterArg = fetchBinaryMock.mock.calls[0][0] as string;
    expect(posterArg).toContain("99");
    expect(posterArg).toContain("v=abc");
    expect(redisMocks.setCacheValue).toHaveBeenCalled();
  });

  it("returns 404 with fallback for Letterboxd 403", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    fetchBinaryMock.mockRejectedValue(new LetterboxdHttpError("forbidden", HTTP_STATUS_FORBIDDEN));
    const args = ctx({ filmId: "1", filmSlug: "x" });
    await letterboxdPoster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Poster not available", fallback: true }),
    );
  });

  it("returns 404 for Letterboxd 404", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    fetchBinaryMock.mockRejectedValue(new LetterboxdHttpError("nf", HTTP_STATUS_NOT_FOUND));
    const args = ctx({ filmId: "1", filmSlug: "y" });
    await letterboxdPoster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
  });

  it("captures with Sentry and returns 500 on other errors when client exists", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    fetchBinaryMock.mockRejectedValue(new Error("boom"));
    sentryMocks.getClient.mockReturnValue({} as never);
    const args = ctx({ filmId: "1", filmSlug: "z" });
    await letterboxdPoster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(sentryMocks.captureException).toHaveBeenCalled();
  });
});
