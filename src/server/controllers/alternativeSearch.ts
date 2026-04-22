import type { HttpHandler } from "../httpContext.js";
import axiosHelper from "../lib/axios.js";
import { getCacheValue, setCacheValue } from "../lib/redis.js";
import { alternativeSearchBodySchema, firstZodIssueMessage } from "../lib/apiSchemas.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_UNAUTHORIZED,
} from "../httpStatusCodes.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 3600;

interface JackettResult {
  Seeders?: number;
  Title?: string;
  Tracker?: string;
  Details?: string;
}

export const alternativeSearch: HttpHandler = async ({ req, res }) => {
  const parsedBody = alternativeSearchBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { title, year } = parsedBody.data;

  const jackettKey = process.env.JACKETT_API_KEY;
  const jackettEndpoint = process.env.JACKETT_API_ENDPOINT;
  if (!jackettKey?.trim() || !jackettEndpoint?.trim()) {
    res
      .status(HTTP_STATUS_SERVICE_UNAVAILABLE)
      .json({ error: "Alternative search is not configured" });
    return;
  }

  try {
    let searchQuery = `${title}${year != null && year !== "" ? ` ${year}` : ""}`.replace(/ /g, "+");

    const cacheKey = `jackett:${searchQuery}:`;
    const cachedResponse = (await getCacheValue(cacheKey)) as
      | { error?: string; message?: string; [k: string]: unknown }
      | null
      | undefined;
    if (cachedResponse) {
      const status = cachedResponse.error ? HTTP_STATUS_NOT_FOUND : HTTP_STATUS_OK;
      console.log("Response found (cached)");
      res.status(status).json(cachedResponse);
      return;
    }

    const categories = { film: 2000 };
    const baseUrl = `${jackettEndpoint}/api/v2.0/indexers/all/results?apikey=${jackettKey}&Category=${categories.film}`;
    let { data } = await axios.get<{ Results?: JackettResult[] }>(
      `${baseUrl}&Query=${searchQuery}`,
    );
    let results = data.Results ?? [];
    if (results.length === 0) {
      console.log(`No results found, trying again without year (${title} ${year})`);
      searchQuery = `${title}`.replace(/ /g, "+");
      const retry = await axios.get<{ Results?: JackettResult[] }>(
        `${baseUrl}&Query=${searchQuery}`,
      );
      results = retry.data.Results ?? [];
    }

    let maxSeeders = 0;
    let bestResult: JackettResult | null = null;
    for (const result of results) {
      if ((result.Seeders ?? 0) > maxSeeders && !containsBlacklistedWord(result.Title ?? "")) {
        maxSeeders = result.Seeders ?? 0;
        bestResult = result;
      }
    }

    if (bestResult) {
      console.log(bestResult);
      const response = {
        message: "Alternative search result",
        text: `[${bestResult.Tracker}] ${bestResult.Title} - ${bestResult.Details}`,
        url: bestResult.Details,
        query: searchQuery,
        title,
        year,
      };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(HTTP_STATUS_OK).json(response);
    } else {
      const response = { error: "No results found." };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(HTTP_STATUS_NOT_FOUND).json(response);
    }
  } catch (error) {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === HTTP_STATUS_UNAUTHORIZED) {
      res
        .status(HTTP_STATUS_UNAUTHORIZED)
        .json({ error: "Alternative search temporarily disabled" });
      return;
    }
    console.error(error);
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

function containsBlacklistedWord(title: string): boolean {
  const blacklist = ["HSBS", "3D", "3-D", "3DHSBS", "3D-HSBS"];
  return blacklist.some((word) => title.includes(word));
}
