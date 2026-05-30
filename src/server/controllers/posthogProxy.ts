import type { HttpHandler } from "../httpContext.js";
import { HTTP_STATUS_BAD_GATEWAY, HTTP_STATUS_BAD_REQUEST } from "../httpStatusCodes.js";

const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

const POSTHOG_PROXY_PREFIX = "/api/reversa";

const RECORDER_INNOCUOUS_NAME = "rec";

function buildProxyHeaders(
  headers: Record<string, unknown>,
  ip: string | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};

  const ct = headers["content-type"] as string | string[] | undefined;
  if (ct) result["content-type"] = Array.isArray(ct) ? ct[0] : ct;

  const accept = headers["accept"] as string | string[] | undefined;
  if (accept) result["accept"] = Array.isArray(accept) ? accept[0] : accept;

  const ua = headers["user-agent"] as string | string[] | undefined;
  if (ua) result["user-agent"] = Array.isArray(ua) ? ua[0] : ua;

  const flyClientIp = headers["fly-client-ip"] as string | string[] | undefined;
  const clientIp = (Array.isArray(flyClientIp) ? flyClientIp[0] : flyClientIp) || ip;
  if (clientIp) result["x-forwarded-for"] = clientIp;

  return result;
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

function extractPath(url: string): string {
  const prefixIndex = url.indexOf(POSTHOG_PROXY_PREFIX);
  return prefixIndex === -1 ? url : url.slice(prefixIndex + POSTHOG_PROXY_PREFIX.length);
}

export const posthogProxyHandler: HttpHandler = async ({ req, res }) => {
  const targetHost = process.env.POSTHOG_HOST || POSTHOG_DEFAULT_HOST;

  let posthogPath = extractPath(req.url);

  const isConfigRequest = req.method === "GET" && posthogPath.endsWith("/config.js");

  const queryIndex = posthogPath.indexOf("?");
  const pathname = queryIndex === -1 ? posthogPath : posthogPath.slice(0, queryIndex);

  if (!isAllowedPosthogPath(pathname)) {
    res.status(HTTP_STATUS_BAD_REQUEST).send({ error: "Bad Request" });
    return;
  }

  if (pathname === `/static/${RECORDER_INNOCUOUS_NAME}.js`) {
    const query = queryIndex === -1 ? "" : posthogPath.slice(queryIndex);
    posthogPath = `/static/posthog-recorder.js${query}`;
  }

  const targetUrl = `${targetHost}${posthogPath}`;

  try {
    const headers = buildProxyHeaders(req.headers, req.ip);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body) {
        if (typeof req.body === "string") {
          fetchOptions.body = req.body;
        } else if (Buffer.isBuffer(req.body)) {
          fetchOptions.body = req.body as BodyInit;
        } else {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    res.status(response.status);

    const responseContentType = response.headers.get("content-type");
    if (responseContentType) {
      res.setHeader("content-type", responseContentType);
    }

    let body = await response.text();

    if (isConfigRequest) {
      body = renameRecorderScriptInConfig(body);
    }

    res.send(body);
  } catch (err) {
    console.error("PostHog proxy error:", err);
    res.status(HTTP_STATUS_BAD_GATEWAY).send({ error: "PostHog upstream unavailable" });
  }
};
