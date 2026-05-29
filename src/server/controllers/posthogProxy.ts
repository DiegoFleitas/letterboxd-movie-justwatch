import type { FastifyRequest, FastifyReply } from "fastify";
import { HTTP_STATUS_BAD_GATEWAY } from "../httpStatusCodes.js";

const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

const POSTHOG_PROXY_PREFIX = "/api/reversa";

function buildProxyHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  const ct = request.headers["content-type"];
  if (ct) headers["content-type"] = Array.isArray(ct) ? ct[0] : ct;

  const accept = request.headers["accept"];
  if (accept) headers["accept"] = Array.isArray(accept) ? accept[0] : accept;

  const ua = request.headers["user-agent"];
  if (ua) headers["user-agent"] = Array.isArray(ua) ? ua[0] : ua;

  return headers;
}

export async function posthogProxyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const targetHost = process.env.POSTHOG_HOST || POSTHOG_DEFAULT_HOST;

  const requestUrl = request.url;
  const prefixIndex = requestUrl.indexOf(POSTHOG_PROXY_PREFIX);
  const posthogPath =
    prefixIndex === -1 ? requestUrl : requestUrl.slice(prefixIndex + POSTHOG_PROXY_PREFIX.length);

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

    const body = await response.text();
    reply.send(body);
  } catch (err) {
    console.error("PostHog proxy error:", err);
    reply.code(HTTP_STATUS_BAD_GATEWAY).send({ error: "PostHog upstream unavailable" });
  }
}
