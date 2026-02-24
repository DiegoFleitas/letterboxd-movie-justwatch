import type { Request, Response } from "express";
import axiosHelper from "../helpers/axios.js";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const axios = axiosHelper(true);
const postersTtl = Number(process.env.CACHE_TTL) || 60;

export const letterboxdPoster = async (req: Request, res: Response): Promise<void> => {
  const { filmId, filmSlug, cacheBustingKey } = req.body as {
    filmId?: string;
    filmSlug?: string;
    cacheBustingKey?: string;
  };

  if (!filmId || !filmSlug) {
    res.status(400).json({ error: "Missing filmId or filmSlug" });
    return;
  }

  const cacheKey = `letterboxd-poster:${filmSlug}`;

  try {
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      res.status(200).json({
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

    await axios.get(posterUrl, {
      responseType: "arraybuffer",
      headers: {
        Referer: "https://letterboxd.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    await setCacheValue(cacheKey, posterUrl, postersTtl);

    res.status(200).json({
      message: "Poster found",
      poster: posterUrl,
    });
  } catch (error) {
    console.error(`Failed to fetch poster for ${filmSlug}:`, (error as Error).message);
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 403 || err.response?.status === 404) {
      res.status(404).json({ error: "Poster not available", fallback: true });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
};
