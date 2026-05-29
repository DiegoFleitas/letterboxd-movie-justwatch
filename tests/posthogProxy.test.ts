import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTP_API_PATHS } from "@server/routes.js";
import { HTTP_STATUS_BAD_GATEWAY } from "@server/httpStatusCodes.js";
import type { FastifyRequest, FastifyReply } from "fastify";

import { posthogProxyHandler } from "@server/controllers/posthogProxy.js";

const POSTHOG_HOST = "https://us.i.posthog.com";
const PROXY_PREFIX = HTTP_API_PATHS.posthogProxyPrefix;

function createMockReply(): {
  reply: FastifyReply;
  getStatus: () => number;
  getBody: () => unknown;
  getHeader: (name: string) => string | undefined;
} {
  let statusCode = 0;
  let body: unknown;
  const headers = new Map<string, string>();

  const reply = {
    code(code: number) {
      statusCode = code;
      return reply;
    },
    header(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return reply;
    },
    type(contentType: string) {
      headers.set("content-type", contentType);
      return reply;
    },
    send(payload: unknown) {
      body = payload;
      return reply;
    },
  } as unknown as FastifyReply;

  return {
    reply,
    getStatus: () => statusCode,
    getBody: () => body,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
  };
}

function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    url: `${PROXY_PREFIX}/capture/`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "test-agent",
      origin: "https://movie-justwatch.fly.dev",
    },
    body: { event: "test_event", api_key: "phc_test" },
    ...overrides,
  } as unknown as FastifyRequest;
}

describe("posthogProxyHandler", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let originalPosthogHost: string | undefined;

  beforeEach(() => {
    originalPosthogHost = process.env.POSTHOG_HOST;
    process.env.POSTHOG_HOST = POSTHOG_HOST;

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    if (originalPosthogHost === undefined) {
      delete process.env.POSTHOG_HOST;
    } else {
      process.env.POSTHOG_HOST = originalPosthogHost;
    }
    vi.restoreAllMocks();
  });

  it("forwards GET request to PostHog and returns upstream response", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ featureFlags: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/decide/?api_key=phc_test`,
      method: "GET",
      body: undefined,
    });
    const { reply, getStatus, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getStatus()).toBe(200);
    expect(getBody()).toBe(JSON.stringify({ featureFlags: [] }));

    const fetchUrl = fetchSpy.mock.calls[0]?.[0];
    expect(fetchUrl).toBe(`${POSTHOG_HOST}/decide/?api_key=phc_test`);
  });

  it("forwards POST request with JSON body", async () => {
    const req = createMockRequest({
      url: `${PROXY_PREFIX}/capture/`,
      method: "POST",
      body: { event: "movie_search", properties: { query: "test" } },
    });
    const { reply, getStatus, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getStatus()).toBe(200);
    expect(getBody()).toBe(JSON.stringify({ status: "ok" }));

    const fetchUrl = fetchSpy.mock.calls[0]?.[0];
    expect(fetchUrl).toBe(`${POSTHOG_HOST}/capture/`);

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchInit.method).toBe("POST");
    expect(fetchInit.body).toBe(
      JSON.stringify({ event: "movie_search", properties: { query: "test" } }),
    );
  });

  it("forwards POST request with text/plain body as-is (no JSON.stringify)", async () => {
    const req = createMockRequest({
      url: `${PROXY_PREFIX}/capture/`,
      method: "POST",
      headers: {
        "content-type": "text/plain; charset=UTF-8",
        accept: "application/json",
        "user-agent": "test-agent",
      },
      body: '{"event":"$pageview","api_key":"phc_test","distinct_id":"user-1"}',
    });
    const { reply, getStatus, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getStatus()).toBe(200);
    expect(getBody()).toBe(JSON.stringify({ status: "ok" }));

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchInit.body).toBe(
      '{"event":"$pageview","api_key":"phc_test","distinct_id":"user-1"}',
    );
  });

  it("forwards POST request with Buffer body (gzip-compressed binary) as-is", async () => {
    const compressedBody = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/i/v0/e/?compression=gzip-js`,
      method: "POST",
      headers: {
        "content-type": "text/plain; charset=UTF-8",
        accept: "application/json",
        "user-agent": "test-agent",
      },
      body: compressedBody,
    });
    const { reply, getStatus } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getStatus()).toBe(200);

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchInit.body).toBe(compressedBody);
  });

  it("forwards POST request without body", async () => {
    const req = createMockRequest({
      url: `${PROXY_PREFIX}/capture/`,
      method: "POST",
      body: undefined,
    });
    const { reply, getStatus } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getStatus()).toBe(200);

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchInit.body).toBeUndefined();
  });

  it("strips the /api/reversa prefix when constructing target URL", async () => {
    const req = createMockRequest({
      url: `${PROXY_PREFIX}/capture/?api_key=phc_test`,
      method: "GET",
      body: undefined,
    });
    const { reply } = createMockReply();

    await posthogProxyHandler(req, reply);

    const fetchUrl = fetchSpy.mock.calls[0]?.[0];
    expect(fetchUrl).toBe(`${POSTHOG_HOST}/capture/?api_key=phc_test`);
  });

  it("forwards content-type, accept, and user-agent headers", async () => {
    const req = createMockRequest({
      method: "POST",
      body: { event: "test" },
    });
    const { reply } = createMockReply();

    await posthogProxyHandler(req, reply);

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["accept"]).toBe("application/json");
    expect(headers["user-agent"]).toBe("test-agent");
  });

  it("does NOT forward origin header to PostHog", async () => {
    const req = createMockRequest({
      method: "POST",
      body: { event: "test" },
    });
    const { reply } = createMockReply();

    await posthogProxyHandler(req, reply);

    const fetchInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["origin"]).toBeUndefined();
  });

  it("forwards upstream content-type to the client", async () => {
    fetchSpy.mockResolvedValue(
      new Response("posthog.array(...)", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/s/array.js`,
      method: "GET",
      body: undefined,
    });
    const { reply, getHeader } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getHeader("content-type")).toBe("application/javascript");
  });

  it("returns BAD_GATEWAY when upstream fetch fails", async () => {
    fetchSpy.mockRejectedValue(new Error("upstream unreachable"));

    const req = createMockRequest({ method: "GET", body: undefined });
    const { reply, getStatus, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getStatus()).toBe(HTTP_STATUS_BAD_GATEWAY);
    expect(getBody()).toEqual({ error: "PostHog upstream unavailable" });
  });

  it('rewrites "posthog-recorder" to "rec" in config.js response to bypass adblockers', async () => {
    const upstreamBody = `
(function() {
  window._POSTHOG_REMOTE_CONFIG['phc_test'] = {
    config: {"sessionRecording":{"scriptConfig":{"script":"posthog-recorder"}}}
  };
})();`;

    fetchSpy.mockResolvedValue(
      new Response(upstreamBody, {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/array/phc_test/config.js`,
      method: "GET",
      body: undefined,
    });
    const { reply, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    const body = getBody() as string;
    expect(body).toContain('"script":"rec"');
    expect(body).not.toContain('"script":"posthog-recorder"');
  });

  it("rewrites /static/rec.js upstream to /static/posthog-recorder.js", async () => {
    fetchSpy.mockResolvedValue(
      new Response("recorder script content", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/static/rec.js`,
      method: "GET",
      body: undefined,
    });
    const { reply, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    const fetchUrl = fetchSpy.mock.calls[0]?.[0];
    expect(fetchUrl).toBe(`${POSTHOG_HOST}/static/posthog-recorder.js`);
    expect(getBody()).toBe("recorder script content");
  });

  it("rewrites /static/rec.js with query string to posthog-recorder upstream", async () => {
    fetchSpy.mockResolvedValue(
      new Response("recorder script content", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/static/rec.js?v=1.374.2`,
      method: "GET",
      body: undefined,
    });
    const { reply } = createMockReply();

    await posthogProxyHandler(req, reply);

    const fetchUrl = fetchSpy.mock.calls[0]?.[0];
    expect(fetchUrl).toBe(`${POSTHOG_HOST}/static/posthog-recorder.js?v=1.374.2`);
  });

  it("forwards upstream non-JSON (text) response body", async () => {
    fetchSpy.mockResolvedValue(
      new Response("plain text body", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/capture/`,
      method: "GET",
      body: undefined,
    });
    const { reply, getBody } = createMockReply();

    await posthogProxyHandler(req, reply);

    expect(getBody()).toBe("plain text body");
  });

  it("uses POSTHOG_HOST env var as upstream target", async () => {
    process.env.POSTHOG_HOST = "https://eu.posthog.com";

    const req = createMockRequest({
      url: `${PROXY_PREFIX}/capture/`,
      method: "GET",
      body: undefined,
    });
    const { reply } = createMockReply();

    await posthogProxyHandler(req, reply);

    const fetchUrl = fetchSpy.mock.calls[0]?.[0];
    expect(fetchUrl).toBe("https://eu.posthog.com/capture/");
  });

  describe("path allowlist", () => {
    it("allows /capture/", async () => {
      fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }));
      const req = createMockRequest({ url: `${PROXY_PREFIX}/capture/`, method: "POST" });
      const { reply, getStatus } = createMockReply();
      await posthogProxyHandler(req, reply);
      expect(getStatus()).toBe(200);
    });

    it("rejects path traversal /../", async () => {
      const req = createMockRequest({
        url: `${PROXY_PREFIX}/../etc/passwd`,
        method: "GET",
        body: undefined,
      });
      const { reply, getStatus, getBody } = createMockReply();
      await posthogProxyHandler(req, reply);
      expect(getStatus()).toBe(400);
      expect(getBody()).toEqual({ error: "Bad Request" });
    });

    it("rejects URL-encoded dot traversal %2e%2e", async () => {
      const req = createMockRequest({
        url: `${PROXY_PREFIX}/%2e%2e/etc/passwd`,
        method: "GET",
        body: undefined,
      });
      const { reply, getStatus, getBody } = createMockReply();
      await posthogProxyHandler(req, reply);
      expect(getStatus()).toBe(400);
      expect(getBody()).toEqual({ error: "Bad Request" });
    });

    it("rejects unknown paths like /admin", async () => {
      const req = createMockRequest({
        url: `${PROXY_PREFIX}/admin`,
        method: "GET",
        body: undefined,
      });
      const { reply, getStatus } = createMockReply();
      await posthogProxyHandler(req, reply);
      expect(getStatus()).toBe(400);
    });
  });
});
