import type { FastifyRequest, FastifyReply } from "fastify";
import { HTTP_STATUS_BAD_GATEWAY, HTTP_STATUS_BAD_REQUEST } from "../httpStatusCodes.js";

const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

const POSTHOG_PROXY_PREFIX = "/api/reversa";

const RECORDER_INNOCUOUS_NAME = "rec";

function buildProxyHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  const ct = request.headers["content-type"];
  if (ct) headers["content-type"] = Array.isArray(ct) ? ct[0] : ct;

  const accept = request.headers["accept"];
  if (accept) headers["accept"] = Array.isArray(accept) ? accept[0] : accept;

  const ua = request.headers["user-agent"];
  if (ua) headers["user-agent"] = Array.isArray(ua) ? ua[0] : ua;

  const flyClientIp = request.headers["fly-client-ip"];
  const xForwardedFor = request.headers["x-forwarded-for"];
  const clientIp =
    (Array.isArray(flyClientIp) ? flyClientIp[0] : flyClientIp) ||
    (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor?.split(",")[0]?.trim()) ||
    request.ip;
  if (clientIp) headers["x-forwarded-for"] = clientIp;

  return headers;
}

const POSTHOG_ALLOWED_PREFIXES = [
  "/capture/",
  "/e/",
  "/batch/",
  "/decide/",
  "/flags/",
  "/static/",
  "/array/",
  "/surveys/",
  "/i/v0/",
  "/s/",
];

function isAllowedPosthogPath(pathname: string): boolean {
  if (pathname.includes("..") || pathname.includes("%2e") || pathname.includes("%2E")) return false;
  if (pathname.endsWith("/config.js")) return true;
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return POSTHOG_ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function renameRecorderScriptInConfig(body: string): string {
  return body.replace('"script":"posthog-recorder"', `"script":"${RECORDER_INNOCUOUS_NAME}"`);
}

function extractPath(request: FastifyRequest): string {
  const prefixIndex = request.url.indexOf(POSTHOG_PROXY_PREFIX);
  return prefixIndex === -1
    ? request.url
    : request.url.slice(prefixIndex + POSTHOG_PROXY_PREFIX.length);
}

export async function posthogProxyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const targetHost = process.env.POSTHOG_HOST || POSTHOG_DEFAULT_HOST;

  let posthogPath = extractPath(request);

  const isConfigRequest = request.method === "GET" && posthogPath.endsWith("/config.js");

  const queryIndex = posthogPath.indexOf("?");
  const pathname = queryIndex === -1 ? posthogPath : posthogPath.slice(0, queryIndex);

  if (!isAllowedPosthogPath(pathname)) {
    await reply.code(HTTP_STATUS_BAD_REQUEST).send({ error: "Bad Request" });
    return;
  }

  if (pathname === `/static/${RECORDER_INNOCUOUS_NAME}.js`) {
    const query = queryIndex === -1 ? "" : posthogPath.slice(queryIndex);
    posthogPath = `/static/posthog-recorder.js${query}`;
  }

  const targetUrl = `${targetHost}${posthogPath}`;

  try {
    const headers = buildProxyHeaders(request);

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      if (request.body) {
        if (typeof request.body === "string") {
          fetchOptions.body = request.body;
        } else if (Buffer.isBuffer(request.body)) {
          fetchOptions.body = request.body as BodyInit;
        } else {
          fetchOptions.body = JSON.stringify(request.body);
        }
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    reply.code(response.status);

    const responseContentType = response.headers.get("content-type");
    if (responseContentType) {
      reply.header("content-type", responseContentType);
    }

    let body = await response.text();

    if (isConfigRequest) {
      body = renameRecorderScriptInConfig(body);
    }

    reply.send(body);
  } catch (err) {
    console.error("PostHog proxy error:", err);
    reply.code(HTTP_STATUS_BAD_GATEWAY).send({ error: "PostHog upstream unavailable" });
  }
}
