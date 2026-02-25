import type { Request, Response } from "express";
import axiosHelper from "../helpers/axios.js";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 60;

export const proxy = async (req: Request, res: Response): Promise<void> => {
  const url = req.originalUrl.replace("/api/proxy/", "");
  const { method } = req;
  try {
    if (!url) {
      console.log("No url");
      res.status(404).json({ message: "Url not found" });
      return;
    }
    let response: { status: number; data: unknown };

    const cacheKey = `proxy:${method}:${url}:${JSON.stringify(req.body)}`;
    const cachedResponse = await getCacheValue(cacheKey);
    if (cachedResponse) {
      console.log("Response found (cached)");
      res.status(200).json(cachedResponse);
      return;
    }

    switch (method) {
      case "GET":
        response = await axios.get(addApiKeyToUrl(url));
        break;
      case "POST":
        response = await axios.post(addApiKeyToUrl(url));
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
  const result = urlObj.toString();
  console.log(result);
  return result;
}
