import type { Request, Response } from "express";
import axiosHelper from "../helpers/axios.js";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 60;

export const poster = async (req: Request, res: Response): Promise<void> => {
  const omdbApiKey = process.env.OMDB_API_KEY;
  let { title, year } = req.body as { title?: string; year?: string | number };
  const cacheKey = `poster:${title}:${year}`;
  try {
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      console.log("Poster found (cached)");
      res.status(200).json({
        message: "Poster found",
        poster: cachedPoster,
      });
      return;
    }

    if (!title) {
      console.log("No movie title");
      res.status(404).json({ error: "Movie not found" });
      return;
    }

    if (title.includes(":")) {
      title = title.split(":")[0];
    }

    const encodedTitle = encodeURIComponent(title);
    const response = await axios.get(
      `http://www.omdbapi.com/?t=${encodedTitle}&y=${year}&apikey=${omdbApiKey}`
    );

    const data = response?.data as
      | { Error?: string; Poster?: string; Year?: string; Released?: string }
      | undefined;
    if (!response || !data || data.Error) {
      const errorMessage = data?.Error || "Movie not found";
      console.log("Movie not found", errorMessage);
      res.status(404).json({ error: errorMessage });
      return;
    }

    const posterUrl = data.Poster;
    const respYear = data.Year;
    const released = data.Released;
    if (!posterUrl) {
      console.log(`Poster not found for ${title} (${respYear}) release status: ${released}`);
      res.status(404).json({ error: "Poster not found" });
      return;
    }

    await setCacheValue(cacheKey, posterUrl, cacheTtl);
    res.status(200).json({
      message: "Poster found",
      poster: posterUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
