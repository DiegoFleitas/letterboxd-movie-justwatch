import type { HttpHandler } from "../server/httpContext.js";
import axiosHelper from "../lib/axios.js";
import { getCacheValue, setCacheValue } from "../lib/redis.js";
import { parseAllowedProxyUrl } from "../lib/apiSchemas.js";

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
  const url = (req.url || "").replace("/api/proxy/", "");
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
      res.status(200).json(cachedResponse);
      return;
    }

    const finalUrl = addApiKeyToUrl(targetUrl);

    switch (method) {
      case "GET":
        response = await axios.get(finalUrl);
        break;
      case "POST":
        response = await axios.post(finalUrl, postBodyForAxios(req.body));
        break;
      default:
        res.status(400).json({ error: "Method not allowed" });
        return;
    }
    await setCacheValue(cacheKey, response?.data, cacheTtl);
    res.status(response.status).json(response?.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

function addApiKeyToUrl(url: string): string {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  switch (domain) {
    case "www.omdbapi.com":
      urlObj.searchParams.append("apikey", process.env.OMDB_API_KEY ?? "");
      break;
    case "api.themoviedb.org":
      urlObj.searchParams.append("api_key", process.env.MOVIE_DB_API_KEY ?? "");
      break;
    default:
      break;
  }
  return urlObj.toString();
}
