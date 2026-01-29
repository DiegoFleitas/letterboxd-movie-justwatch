import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper(true);
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const postersTtl = process.env.CACHE_TTL || 60; // minutes

/**
 * Proxy endpoint to fetch Letterboxd poster images
 * This avoids CORS and Cloudflare protection issues
 */
export const letterboxdPoster = async (req, res) => {
  const { filmId, filmSlug, cacheBustingKey } = req.body;
  
  if (!filmId || !filmSlug) {
    return res.status(400).json({ error: "Missing filmId or filmSlug" });
  }

  const cacheKey = `letterboxd-poster:${filmSlug}`;
  
  try {
    // Check cache first
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      return res.status(200).json({
        message: "Poster found (cached)",
        poster: cachedPoster,
      });
    }

    // Construct the CDN URL
    const POSTER_WIDTH = 230;
    const POSTER_HEIGHT = 345;
    const idPath = filmId.split('').join('/');
    const cleanSlug = filmSlug.replace(/^\/film\//, '').replace(/\/$/, '');
    const baseUrl = `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${cleanSlug}-0-${POSTER_WIDTH}-0-${POSTER_HEIGHT}-crop.jpg`;
    const posterUrl = cacheBustingKey ? `${baseUrl}?v=${cacheBustingKey}` : baseUrl;

    // Fetch the poster through our server
    const response = await axios.get(posterUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Referer': 'https://letterboxd.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    // Cache the URL
    await setCacheValue(cacheKey, posterUrl, postersTtl);

    // Return the URL instead of the image data to save bandwidth
    return res.status(200).json({
      message: "Poster found",
      poster: posterUrl,
    });

  } catch (error) {
    console.error(`Failed to fetch poster for ${filmSlug}:`, error.message);
    
    // Return a fallback or error
    if (error.response?.status === 403 || error.response?.status === 404) {
      return res.status(404).json({ 
        error: "Poster not available",
        fallback: true 
      });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
};
