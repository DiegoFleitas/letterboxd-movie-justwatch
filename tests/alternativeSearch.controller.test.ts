import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_UNAUTHORIZED,
} from "@server/httpStatusCodes.js";
import type { HttpHandlerArgs } from "@server/httpContext.js";

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@server/lib/axios.js", () => ({
  default: () => ({
    get: axiosMocks.get,
    post: vi.fn(),
  }),
}));

const redisMocks = vi.hoisted(() => ({
  getCacheValue: vi.fn(),
  setCacheValue: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@server/lib/redis.js", () => ({
  getCacheValue: (...args: unknown[]) => redisMocks.getCacheValue(...(args as [])),
  setCacheValue: (...args: unknown[]) => redisMocks.setCacheValue(...(args as [])),
}));

function mockRes(): HttpHandlerArgs["res"] & { jsonMock: ReturnType<typeof vi.fn> } {
  const jsonMock = vi.fn();
  const self = {
    json: jsonMock,
    jsonMock,
    statusCode: undefined as number | undefined,
    status(code: number) {
      self.statusCode = code;
      return self;
    },
    send: vi.fn(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return self as HttpHandlerArgs["res"] & { jsonMock: ReturnType<typeof vi.fn> };
}

function ctx(body: unknown): HttpHandlerArgs {
  const res = mockRes();
  return {
    req: {
      body,
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: "/api/alternative-search",
      cookies: {},
      session: {},
      appLocals: {},
    },
    res,
  };
}

describe("alternativeSearch controller", () => {
  let alternativeSearch: (args: HttpHandlerArgs) => Promise<void>;

  beforeEach(async () => {
    vi.stubEnv("JACKETT_API_KEY", "jk");
    vi.stubEnv("JACKETT_API_ENDPOINT", "https://jackett.example");
    axiosMocks.get.mockReset();
    redisMocks.getCacheValue.mockReset();
    redisMocks.setCacheValue.mockReset();
    redisMocks.setCacheValue.mockResolvedValue(true);
    ({ alternativeSearch } = await import("@server/controllers/alternativeSearch.js"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 when body fails Zod validation", async () => {
    const args = ctx({});
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_BAD_REQUEST);
    expect(r.jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it("returns 503 when Jackett env is missing", async () => {
    vi.unstubAllGlobals();
    vi.stubEnv("JACKETT_API_KEY", "");
    vi.stubEnv("JACKETT_API_ENDPOINT", "");
    vi.resetModules();
    const { alternativeSearch: alt } = await import("@server/controllers/alternativeSearch.js");
    const args = ctx({ title: "Film" });
    await alt(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Alternative search is not configured" }),
    );
  });

  it("returns cached payload with 200 when cache has success shape", async () => {
    redisMocks.getCacheValue.mockResolvedValue({
      message: "Alternative search result",
      text: "[t] x - u",
      url: "https://detail",
    });
    const args = ctx({ title: "Film", year: "2020" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Alternative search result" }),
    );
    expect(axiosMocks.get).not.toHaveBeenCalled();
  });

  it("returns 404 JSON when cache has error field", async () => {
    redisMocks.getCacheValue.mockResolvedValue({ error: "No results found." });
    const args = ctx({ title: "Film" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
    expect(r.jsonMock).toHaveBeenCalledWith({ error: "No results found." });
  });

  it("returns best Jackett result by seeders", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({
      data: {
        Results: [
          { Seeders: 1, Title: "Low", Tracker: "A", Details: "https://a" },
          { Seeders: 99, Title: "High", Tracker: "B", Details: "https://best" },
        ],
      },
    });
    const args = ctx({ title: "Matrix", year: "1999" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://best",
        title: "Matrix",
        year: "1999",
      }),
    );
    expect(redisMocks.setCacheValue).toHaveBeenCalled();
  });

  it("retries Jackett query without year when first response empty", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValueOnce({ data: { Results: [] } }).mockResolvedValueOnce({
      data: {
        Results: [{ Seeders: 5, Title: "RetryHit", Tracker: "T", Details: "https://retry" }],
      },
    });
    const args = ctx({ title: "Obscure", year: "2001" });
    await alternativeSearch(args);
    expect(axiosMocks.get).toHaveBeenCalledTimes(2);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(r.jsonMock).toHaveBeenCalledWith(expect.objectContaining({ url: "https://retry" }));
  });

  it("skips blacklisted title words when picking best result", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({
      data: {
        Results: [
          { Seeders: 100, Title: "Bad 3D HSBS rip", Tracker: "X", Details: "https://bad" },
          { Seeders: 2, Title: "Clean rip", Tracker: "Y", Details: "https://good" },
        ],
      },
    });
    const args = ctx({ title: "Thing" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.jsonMock).toHaveBeenCalledWith(expect.objectContaining({ url: "https://good" }));
  });

  it("returns 404 when Jackett has no usable results", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get
      .mockResolvedValueOnce({ data: { Results: [] } })
      .mockResolvedValueOnce({ data: { Results: [] } });
    const args = ctx({ title: "Nothing" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
    expect(r.jsonMock).toHaveBeenCalledWith({ error: "No results found." });
  });

  it("returns 401 JSON when Jackett responds 401", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const err = Object.assign(new Error("unauth"), {
      response: { status: HTTP_STATUS_UNAUTHORIZED },
    });
    axiosMocks.get.mockRejectedValue(err);
    const args = ctx({ title: "X" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_UNAUTHORIZED);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Alternative search temporarily disabled" }),
    );
  });

  it("returns 500 on unexpected Jackett error", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockRejectedValue(new Error("boom"));
    const args = ctx({ title: "X" });
    await alternativeSearch(args);
    const r = args.res as ReturnType<typeof mockRes>;
    expect(r.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
    expect(r.jsonMock).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});
