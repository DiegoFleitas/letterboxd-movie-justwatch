import type { Request, Response } from "express";
import axiosHelper from "../helpers/axios.js";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 3600;

interface JackettResult {
  Seeders?: number;
  Title?: string;
  Tracker?: string;
  Details?: string;
}

export const alternativeSearch = async (req: Request, res: Response): Promise<void> => {
  const { title, year } = req.body as { title?: string; year?: string | number };

  const jackettKey = process.env.JACKETT_API_KEY;
  const jackettEndpoint = process.env.JACKETT_API_ENDPOINT;

  try {
    let searchQuery = `${title} ${year}`.replace(/ /g, "+");

    const cacheKey = `jackett:${searchQuery}:`;
    const cachedResponse = await getCacheValue(cacheKey) as
      | { error?: string; message?: string; [k: string]: unknown }
      | null
      | undefined;
    if (cachedResponse) {
      const status = cachedResponse.error ? 404 : 200;
      console.log("Response found (cached)");
      res.status(status).json(cachedResponse);
      return;
    }

    const categories = { film: 2000 };
    const baseUrl = `${jackettEndpoint}/api/v2.0/indexers/all/results?apikey=${jackettKey}&Category=${categories.film}`;
    let { data } = await axios.get<{ Results?: JackettResult[] }>(
      `${baseUrl}&Query=${searchQuery}`
    );
    let results = data.Results ?? [];
    if (results.length === 0) {
      console.log(`No results found, trying again without year (${title} ${year})`);
      searchQuery = `${title}`.replace(/ /g, "+");
      const retry = await axios.get<{ Results?: JackettResult[] }>(
        `${baseUrl}&Query=${searchQuery}`
      );
      results = retry.data.Results ?? [];
    }

    let maxSeeders = 0;
    let bestResult: JackettResult | null = null;
    for (const result of results) {
      if (
        (result.Seeders ?? 0) > maxSeeders &&
        !containsBlacklistedWord(result.Title ?? "")
      ) {
        maxSeeders = result.Seeders ?? 0;
        bestResult = result;
      }
    }

    if (bestResult) {
      console.log(bestResult);
      const response = {
        message: "🏴‍☠️",
        text: `[${bestResult.Tracker}] ${bestResult.Title} - ${bestResult.Details}`,
        url: bestResult.Details,
        query: searchQuery,
        title,
        year,
      };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(200).json(response);
    } else {
      const response = { error: "No results found." };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(404).json(response);
    }
  } catch (error) {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 401) {
      res.status(401).json({ error: "Alternative search temporarily disabled" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

function containsBlacklistedWord(title: string): boolean {
  const blacklist = ["HSBS", "3D", "3-D", "3DHSBS", "3D-HSBS"];
  return blacklist.some((word) => title.includes(word));
}
