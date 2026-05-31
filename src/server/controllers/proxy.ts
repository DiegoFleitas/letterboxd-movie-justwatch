import type { HttpHandler } from "../httpContext.js";
import { proxyTargetFromRequestUrl } from "../routes.js";
import axiosHelper from "../lib/axios.js";
import { getCacheValue, setCacheValue } from "../lib/redis.js";
import { parseAllowedProxyUrl } from "../lib/apiSchemas.js";
import { captureServerException } from "../lib/sentryCapture.js";
import {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_METHOD_NOT_ALLOWED,
  HTTP_STATUS_OK,
} from "../httpStatusCodes.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 60;

export { PROXY_ALLOWED_HOSTNAMES, parseAllowedProxyUrl } from "../lib/apiSchemas.js";
export type { ParseProxyUrlResult } from "../lib/apiSchemas.js";

function postBodyForAxios(body: unknown): unknown {
  if (body === null || body === undefined) return undefined;
  if (typeof body !== "object" || Array.isArray(body)) return body;
  if (Object.keys(body as Record<string, unknown>).length === 0) return undefined;
  return body;
}

export const proxy: HttpHandler = async ({ req, res }) => {
  const url = proxyTargetFromRequestUrl(req.url || "");
  const { method } = req;
  try {
    const parsed = parseAllowedProxyUrl(url);
    if (!parsed.ok) {
      res.status(parsed.status).json({ error: parsed.message });
      return;
    }
    const targetUrl = parsed.url.toString();
    let response: { status: number; data: unknown };

    const cacheKey = `proxy:${method}:${targetUrl}:${JSON.stringify(req.body)}`;
    const cachedResponse = await getCacheValue(cacheKey);
    if (cachedResponse) {
      res.status(HTTP_STATUS_OK).json(cachedResponse);
      return;
    }

    const { url: finalUrl, headers: authHeaders } = prepareRequest(targetUrl);

    switch (method) {
      case "GET":
        response = await axios.get(finalUrl, { headers: authHeaders });
        break;
      case "POST":
        response = await axios.post(finalUrl, postBodyForAxios(req.body), { headers: authHeaders });
        break;
      default:
        res.setHeader("Allow", "GET, POST");
        res.status(HTTP_STATUS_METHOD_NOT_ALLOWED).json({ error: "Method not allowed" });
        return;
    }
    await setCacheValue(cacheKey, response?.data, cacheTtl);
    res.status(response.status).json(response?.data);
  } catch (error) {
    console.error(error);
    captureServerException(error, { route: "proxy" });
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

function prepareRequest(url: string): { url: string; headers: Record<string, string> } {
  const urlObj = new URL(url);
  const headers: Record<string, string> = {};
  switch (urlObj.hostname) {
    case "www.omdbapi.com":
      // OMDb has no header-based auth; query param is the only option
      urlObj.searchParams.append("apikey", process.env.OMDB_API_KEY ?? "");
      break;
    case "api.themoviedb.org":
      headers["Authorization"] = `Bearer ${process.env.MOVIE_DB_API_KEY ?? ""}`;
      break;
    default:
      break;
  }
  return { url: urlObj.toString(), headers };
}
