import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
} from "@server/httpStatusCodes.js";
import type { HttpHandler, HttpHandlerArgs } from "@server/httpContext.js";

const axiosMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@server/lib/axios.js", () => ({
  default: () => ({ get: axiosMocks.get, post: vi.fn() }),
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
      url: "/api/subdl-search",
      cookies: {},
      session: {},
      appLocals: {},
    },
    res,
  };
}

describe("subdlSearch controller", () => {
  let subdlSearch: HttpHandler;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("SUBDL_API_KEY", "subdl-key");
    axiosMocks.get.mockReset();
    ({ subdlSearch } = await import("@server/controllers/subdlSearch.js"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 on invalid body", async () => {
    const args = ctx({});
    await subdlSearch(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_BAD_REQUEST);
  });

  it("returns 503 when SUBDL_API_KEY missing", async () => {
    vi.stubEnv("SUBDL_API_KEY", "");
    vi.resetModules();
    const { subdlSearch: handler } = await import("@server/controllers/subdlSearch.js");
    const args = ctx({ title: "Film" });
    await handler(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_SERVICE_UNAVAILABLE);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Subtitles search is not configured" }),
    );
  });

  it("returns 404 when API response has no usable browse URL", async () => {
    vi.stubEnv("SUBDL_API_KEY", "k");
    vi.resetModules();
    const { subdlSearch: handler } = await import("@server/controllers/subdlSearch.js");
    axiosMocks.get.mockResolvedValue({ data: { status: false, error: "none" } });
    const args = ctx({ title: "Film", year: "2020" });
    await handler(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_NOT_FOUND);
    expect(r.jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: "none" }));
  });

  it("returns 200 with url on success", async () => {
    vi.stubEnv("SUBDL_API_KEY", "k");
    vi.resetModules();
    const { subdlSearch: handler } = await import("@server/controllers/subdlSearch.js");
    axiosMocks.get.mockResolvedValue({
      data: {
        status: true,
        subtitles: [{ subtitle_id: "1", url: "https://subdl.com/s/1" }],
      },
    });
    const args = ctx({ title: "Film" });
    await handler(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_OK);
    expect(r.jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("subdl"), title: "Film" }),
    );
  });

  it("returns 500 when axios throws", async () => {
    vi.stubEnv("SUBDL_API_KEY", "k");
    vi.resetModules();
    const { subdlSearch: handler } = await import("@server/controllers/subdlSearch.js");
    axiosMocks.get.mockRejectedValue(new Error("net"));
    const args = ctx({ title: "Film" });
    await handler(args);
    const r = args.res;
    expect(r.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
  });
});
