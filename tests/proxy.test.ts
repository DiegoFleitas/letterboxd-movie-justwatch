import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes";
import type { HttpRequestContext, HttpResponseContext } from "@server/httpContext.js";

const { mockGet, mockPost, mockGetCache, mockSetCache } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn(),
}));

vi.mock("@server/lib/axios.js", () => ({
  default: () => ({
    get: mockGet,
    post: mockPost,
  }),
}));

vi.mock("@server/lib/redis.js", () => ({
  getCacheValue: (...args: unknown[]) => mockGetCache(...args),
  setCacheValue: (...args: unknown[]) => mockSetCache(...args),
}));

import { parseAllowedProxyUrl, PROXY_ALLOWED_HOSTNAMES, proxy } from "@server/controllers/proxy.js";

describe("parseAllowedProxyUrl", () => {
  it("allows HTTPS TMDb and OMDB hosts", () => {
    const tmdb = parseAllowedProxyUrl("https://api.themoviedb.org/3/search/movie?query=x");
    expect(tmdb.ok).toBe(true);
    if (tmdb.ok) expect(tmdb.url.hostname).toBe("api.themoviedb.org");

    const omdb = parseAllowedProxyUrl("https://www.omdbapi.com/?t=test");
    expect(omdb.ok).toBe(true);
    if (omdb.ok) expect(omdb.url.hostname).toBe("www.omdbapi.com");
  });

  it("rejects non-HTTPS", () => {
    const r = parseAllowedProxyUrl("http://api.themoviedb.org/foo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("rejects disallowed hosts (SSRF / open proxy)", () => {
    const internal = parseAllowedProxyUrl("https://169.254.169.254/latest/meta-data/");
    expect(internal.ok).toBe(false);
    if (!internal.ok) expect(internal.status).toBe(403);

    const evil = parseAllowedProxyUrl("https://evil.com/");
    expect(evil.ok).toBe(false);
  });

  it("rejects empty and invalid URLs", () => {
    expect(parseAllowedProxyUrl("").ok).toBe(false);
    expect(parseAllowedProxyUrl("not-a-url").ok).toBe(false);
  });

  it("documents allowlist contains expected hostnames", () => {
    expect(PROXY_ALLOWED_HOSTNAMES.has("api.themoviedb.org")).toBe(true);
    expect(PROXY_ALLOWED_HOSTNAMES.has("www.omdbapi.com")).toBe(true);
  });
});

describe("proxy handler", () => {
  beforeEach(() => {
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
    mockGet.mockResolvedValue({ status: 200, data: { ok: true } });
    mockPost.mockResolvedValue({ status: 200, data: { posted: true } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createMockRes() {
    let statusCode = 0;
    let jsonBody: unknown;
    const headers: Record<string, string | number | readonly string[]> = {};
    const res: HttpResponseContext = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        jsonBody = payload;
      },
      send() {},
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name] = value;
        return this;
      },
    };
    return {
      res,
      getStatus: () => statusCode,
      getJson: () => jsonBody,
      getHeader: (name: string) => headers[name],
    };
  }

  it("returns 403 and does not call axios for disallowed host", async () => {
    const req: HttpRequestContext = {
      body: {},
      params: {},
      query: {},
      headers: {},
      method: "GET",
      url: `${HTTP_API_PATHS.proxyPrefix}/https://malicious.example/hook`,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus, getJson } = createMockRes();
    await proxy({ req, res });

    expect(getStatus()).toBe(403);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(String((getJson() as { error?: string }).error)).toContain("not allowed");
  });

  it("GET forwards allowed URL through axios.get", async () => {
    const req: HttpRequestContext = {
      body: {},
      params: {},
      query: {},
      headers: {},
      method: "GET",
      url: `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/search/movie?query=test`,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus, getJson } = createMockRes();
    await proxy({ req, res });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const calledUrl = String(mockGet.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("api.themoviedb.org");
    expect(calledUrl).toContain("api_key=");
    expect(getStatus()).toBe(200);
    expect(getJson()).toEqual({ ok: true });
  });

  it("POST omits empty JSON body for axios.post", async () => {
    const req: HttpRequestContext = {
      body: {},
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/foo`,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus } = createMockRes();
    await proxy({ req, res });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0]?.[1]).toBeUndefined();
    expect(getStatus()).toBe(200);
  });

  it("POST forwards non-empty object body", async () => {
    const req: HttpRequestContext = {
      body: { a: 1 },
      params: {},
      query: {},
      headers: {},
      method: "POST",
      url: `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/foo`,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res } = createMockRes();
    await proxy({ req, res });

    expect(mockPost.mock.calls[0]?.[1]).toEqual({ a: 1 });
  });

  it("returns 405 and Allow header for unsupported methods", async () => {
    const req: HttpRequestContext = {
      body: {},
      params: {},
      query: {},
      headers: {},
      method: "PUT",
      url: `${HTTP_API_PATHS.proxyPrefix}/https://api.themoviedb.org/3/foo`,
      cookies: {},
      session: null,
      appLocals: {},
    };
    const { res, getStatus, getJson, getHeader } = createMockRes();
    await proxy({ req, res });

    expect(getStatus()).toBe(405);
    expect(getHeader("Allow")).toBe("GET, POST");
    expect(getJson()).toEqual({ error: "Method not allowed" });
  });
});
