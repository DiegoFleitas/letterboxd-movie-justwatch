import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "@server/httpStatusCodes.js";
import type { HttpHandler, HttpHandlerArgs } from "@server/httpContext.js";

const axiosMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@server/lib/axios.js", () => ({
  default: () => ({ get: axiosMocks.get, post: vi.fn() }),
}));

const redisMocks = vi.hoisted(() => ({
  getCacheValue: vi.fn(),
  setCacheValue: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@server/lib/redis.js", () => ({
  getCacheValue: (...a: unknown[]) => redisMocks.getCacheValue(...(a as [])),
  setCacheValue: (...a: unknown[]) => redisMocks.setCacheValue(...(a as [])),
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
      url: "/api/poster",
      cookies: {},
      session: {},
      appLocals: {},
    },
    res,
  };
}

describe("poster controller", () => {
  let poster: HttpHandler;

  beforeEach(async () => {
    vi.stubEnv("OMDB_API_KEY", "omdb-key");
    axiosMocks.get.mockReset();
    redisMocks.getCacheValue.mockReset();
    redisMocks.setCacheValue.mockReset();
    ({ poster } = await import("@server/controllers/poster.js"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns cached poster from Redis", async () => {
    redisMocks.getCacheValue.mockResolvedValue("https://cached.jpg");
    const args = ctx({ title: "X", year: 2000 });
    await poster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ poster: "https://cached.jpg", message: "Poster found" }),
    );
    expect(axiosMocks.get).not.toHaveBeenCalled();
  });

  it("returns 404 when title missing", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    const args = ctx({ year: 2000 });
    await poster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
  });

  it("strips sequel segment after colon in title before OMDB", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({
      data: { Poster: "https://p.jpg", Year: "2010", Released: "1" },
    });
    const args = ctx({ title: "Alien: Covenant", year: 2017 });
    await poster(args);
    expect(axiosMocks.get).toHaveBeenCalled();
    const url = axiosMocks.get.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("Alien"));
    expect(url).not.toContain(encodeURIComponent("Alien%3A"));
  });

  it("returns 404 when OMDB returns Error", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({ data: { Error: "Movie not found!" } });
    const args = ctx({ title: "Nope", year: 1900 });
    await poster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
  });

  it("returns 404 when Poster field missing", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({
      data: { Year: "2000", Released: "x" },
    });
    const args = ctx({ title: "Ghost", year: 2000 });
    await poster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
  });

  it("returns 200 and caches on OMDB success", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockResolvedValue({
      data: { Poster: "https://omdb/p.jpg", Year: "1999", Released: "1/1/1999" },
    });
    const args = ctx({ title: "Matrix", year: 1999 });
    await poster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(redisMocks.setCacheValue).toHaveBeenCalled();
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ poster: "https://omdb/p.jpg" }),
    );
  });

  it("returns 500 when axios throws", async () => {
    redisMocks.getCacheValue.mockResolvedValue(null);
    axiosMocks.get.mockRejectedValue(new Error("timeout"));
    const args = ctx({ title: "X" });
    await poster(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
  });
});
