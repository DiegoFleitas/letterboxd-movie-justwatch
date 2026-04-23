import type { HttpHandler } from "../httpContext.js";
import * as Sentry from "@sentry/node";
import { getCacheValue, setCacheValue } from "../lib/redis.js";
import {
  LetterboxdHttpError,
  buildLetterboxdImageRequestHeaders,
  fetchLetterboxdBinaryOk,
} from "../lib/letterboxdHttp.js";
import { getRandomScrapeUserAgent } from "../lib/scrapeUserAgent.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from "../httpStatusCodes.js";

const postersTtl = Number(process.env.CACHE_TTL) || 60;

export const letterboxdPoster: HttpHandler = async ({ req, res }) => {
  const { filmId, filmSlug, cacheBustingKey } =
    (req.body as {
      filmId?: string;
      filmSlug?: string;
      cacheBustingKey?: string;
    }) ?? {};

  if (!filmId || !filmSlug) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: "Missing filmId or filmSlug" });
    return;
  }

  const cacheKey = `letterboxd-poster:${filmSlug}`;

  try {
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      res.status(HTTP_STATUS_OK).json({
        message: "Poster found (cached)",
        poster: cachedPoster,
      });
      return;
    }

    const POSTER_WIDTH = 230;
    const POSTER_HEIGHT = 345;
    const idPath = filmId.split("").join("/");
    const cleanSlug = filmSlug.replace(/^\/film\//, "").replace(/\/$/, "");
    const baseUrl = `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${cleanSlug}-0-${POSTER_WIDTH}-0-${POSTER_HEIGHT}-crop.jpg`;
    const posterUrl = cacheBustingKey ? `${baseUrl}?v=${cacheBustingKey}` : baseUrl;

    await fetchLetterboxdBinaryOk(
      posterUrl,
      buildLetterboxdImageRequestHeaders(getRandomScrapeUserAgent()),
    );

    await setCacheValue(cacheKey, posterUrl, postersTtl);

    res.status(HTTP_STATUS_OK).json({
      message: "Poster found",
      poster: posterUrl,
    });
  } catch (error) {
    console.error(`Failed to fetch poster for ${filmSlug}:`, (error as Error).message);
    if (
      error instanceof LetterboxdHttpError &&
      (error.status === HTTP_STATUS_FORBIDDEN || error.status === HTTP_STATUS_NOT_FOUND)
    ) {
      res.status(HTTP_STATUS_NOT_FOUND).json({ error: "Poster not available", fallback: true });
      return;
    }
    if (Sentry.getClient()) {
      Sentry.captureException(error, { extra: { route: "letterboxd-poster", filmSlug } });
    }
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};
