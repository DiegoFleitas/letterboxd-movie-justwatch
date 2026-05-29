import type { HttpHandler } from "../httpContext.js";
import axiosHelper from "../lib/axios.js";
import { getCacheValue, setCacheValue } from "../lib/redis.js";
import { posterBodySchema, firstZodIssueMessage } from "../lib/apiSchemas.js";
import { captureServerException } from "../lib/sentryCapture.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "../httpStatusCodes.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 60;

export const poster: HttpHandler = async ({ req, res }) => {
  const parsedBody = posterBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  let { title, year } = parsedBody.data;
  const omdbApiKey = process.env.OMDB_API_KEY;
  const cacheKey = `poster:${title}:${year}`;
  try {
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      console.log("Poster found (cached)");
      res.status(HTTP_STATUS_OK).json({
        message: "Poster found",
        poster: cachedPoster,
      });
      return;
    }

    if (!title) {
      console.log("No movie title");
      res.status(HTTP_STATUS_NOT_FOUND).json({ error: "Movie not found" });
      return;
    }

    if (title.includes(":")) {
      title = title.split(":")[0];
    }

    const encodedTitle = encodeURIComponent(title);
    const response = await axios.get(
      `https://www.omdbapi.com/?t=${encodedTitle}&y=${year}&apikey=${omdbApiKey}`,
    );

    const data = response?.data as
      | { Error?: string; Poster?: string; Year?: string; Released?: string }
      | undefined;
    if (!response || !data || data.Error) {
      console.log("Movie not found", data?.Error);
      res.status(HTTP_STATUS_NOT_FOUND).json({ error: "Movie not found" });
      return;
    }

    const posterUrl = data.Poster;
    const respYear = data.Year;
    const released = data.Released;
    if (!posterUrl) {
      console.log(`Poster not found for ${title} (${respYear}) release status: ${released}`);
      res.status(HTTP_STATUS_NOT_FOUND).json({ error: "Poster not found" });
      return;
    }

    await setCacheValue(cacheKey, posterUrl, cacheTtl);
    res.status(HTTP_STATUS_OK).json({
      message: "Poster found",
      poster: posterUrl,
    });
  } catch (error) {
    console.error(error);
    captureServerException(error, { route: "poster" });
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};
