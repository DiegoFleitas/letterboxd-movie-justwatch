import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance } from "fastify";
import {
  HTTP_API_PATHS,
  HTTP_API_POSTHOG_PROXY_ROUTE,
  HTTP_API_PROXY_ROUTE,
  posthogProxyTargetFromRequestUrl,
} from "./routes.js";
import {
  searchMovie,
  poster,
  letterboxdWatchlist,
  letterboxdCustomList,
  letterboxdPoster,
  alternativeSearch,
  subdlSearch,
  proxy,
} from "./controllers/index.js";
import { isHealthy, isRedisDisabled } from "./lib/redis.js";
import type { FastifyHttpBinder } from "./fastifyHttpBridge.js";
import {
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_GATEWAY_TIMEOUT,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_OK,
} from "./httpStatusCodes.js";

const POSTHOG_PROXY_TIMEOUT_MS = 30_000;

const POSTHOG_PROXY_STRIP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  // Sensitive credential/session headers — must not be forwarded to a third party
  "cookie",
  "authorization",
  "proxy-authorization",
  // Hop-by-hop headers not meaningful across a proxy boundary
  "te",
  "trailer",
  "upgrade",
]);

function buildPosthogProxyForwardedHeaders(
  incoming: IncomingHttpHeaders,
  targetHost: string,
): Headers {
  const forwardedHeaders = new Headers();
  for (const [name, value] of Object.entries(incoming)) {
    if (value === undefined || POSTHOG_PROXY_STRIP_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    if (Array.isArray(value)) {
      forwardedHeaders.set(name, value.join(","));
      continue;
    }
    if (typeof value === "string") {
      forwardedHeaders.set(name, value);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      forwardedHeaders.set(name, `${value}`);
    }
  }
  forwardedHeaders.set("host", targetHost);
  return forwardedHeaders;
}

function posthogProxyBodyFromRequest(method: string, body: unknown): BodyInit | undefined {
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof Uint8Array) {
    // Node's fetch typing accepts Buffer as BodyInit across runtimes.
    return Buffer.from(body);
  }
  if (body !== undefined) {
    return JSON.stringify(body);
  }
  return undefined;
}

export function registerFastifyAppApi(app: FastifyInstance, binder: FastifyHttpBinder): void {
  const { makeFastifyHandler, setCacheControlFastify } = binder;

  app.get("/healthcheck", async (_request, reply) => {
    reply.type("text/plain").send("OK");
  });

  app.get("/redis-healthcheck", async (_request, reply) => {
    if (isRedisDisabled()) {
      reply.type("text/plain").code(HTTP_STATUS_OK).send("OK (Redis disabled)");
      return;
    }
    if (await isHealthy()) {
      reply.type("text/plain").code(HTTP_STATUS_OK).send("OK");
    } else {
      reply.type("text/plain").code(HTTP_STATUS_INTERNAL_SERVER_ERROR).send("Redis is not healthy");
    }
  });

  app.post(HTTP_API_PATHS.searchMovie, setCacheControlFastify(searchMovie));
  app.post(HTTP_API_PATHS.poster, setCacheControlFastify(poster));
  app.post(HTTP_API_PATHS.letterboxdWatchlist, setCacheControlFastify(letterboxdWatchlist));
  app.post(HTTP_API_PATHS.letterboxdCustomList, setCacheControlFastify(letterboxdCustomList));
  app.post(HTTP_API_PATHS.letterboxdPoster, setCacheControlFastify(letterboxdPoster));
  app.post(HTTP_API_PATHS.alternativeSearch, setCacheControlFastify(alternativeSearch));
  app.post(HTTP_API_PATHS.subdlSearch, setCacheControlFastify(subdlSearch));

  app.all(HTTP_API_PROXY_ROUTE, makeFastifyHandler(proxy));
  app.all(HTTP_API_POSTHOG_PROXY_ROUTE, async (request, reply) => {
    const targetPath = posthogProxyTargetFromRequestUrl(request.url || "");
    const targetHost =
      targetPath.startsWith("/static/") || targetPath.startsWith("/array/")
        ? "us-assets.i.posthog.com"
        : "us.i.posthog.com";
    const targetUrl = `https://${targetHost}${targetPath}`;

    const forwardedHeaders = buildPosthogProxyForwardedHeaders(request.headers, targetHost);
    const rawBody = posthogProxyBodyFromRequest(request.method, request.body);

    let upstream: Response;
    try {
      upstream = await fetch(targetUrl, {
        method: request.method,
        headers: forwardedHeaders,
        body: rawBody,
        signal: AbortSignal.timeout(POSTHOG_PROXY_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      reply.code(isTimeout ? HTTP_STATUS_GATEWAY_TIMEOUT : HTTP_STATUS_BAD_GATEWAY).send();
      return;
    }

    reply.code(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!["transfer-encoding", "content-length"].includes(key.toLowerCase())) {
        reply.header(key, value);
      }
    });
    const bytes = await upstream.arrayBuffer();
    reply.send(Buffer.from(bytes));
  });
}
