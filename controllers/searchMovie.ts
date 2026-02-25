import type { Request, Response } from "express";
import type { AxiosInstance } from "axios";
import axiosHelper from "../helpers/axios.js";
import { getCacheValue, setCacheValue } from "../helpers/redis.js";
import { processOffers } from "../helpers/processOffers.js";
import type { JustWatchOffer } from "../types/index.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 3600;
const CACHE_TTL_UNAVAILABLE = 120;
const JUSTWATCH_TIMEOUT_MS = 15000;
const JUSTWATCH_RETRIES = 3;
const PROXY = "";

async function justWatchPost(
  axiosInstance: AxiosInstance,
  url: string,
  body: object
): Promise<{ data: { data: { popularTitles: { edges: JustWatchOfferEdge[] } } } }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= JUSTWATCH_RETRIES; attempt++) {
    try {
      const res = await axiosInstance.post(url, body, {
        timeout: JUSTWATCH_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Letterboxd-Movie-JustWatch/1.0",
        },
      });
      return res as typeof res & {
        data: { data: { popularTitles: { edges: JustWatchOfferEdge[] } } };
      };
    } catch (err: unknown) {
      lastError = err;
      const e = err as { response?: { status?: number }; code?: string; message?: string };
      const isRetryable =
        !e.response ||
        (e.response.status !== undefined && e.response.status >= 500) ||
        e.response.status === 429 ||
        e.code === "ECONNABORTED" ||
        e.code === "ETIMEDOUT" ||
        e.code === "ENOTFOUND" ||
        e.code === "ECONNRESET";
      if (attempt < JUSTWATCH_RETRIES && isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(
          `JustWatch attempt ${attempt}/${JUSTWATCH_RETRIES} failed, retrying in ${delay}ms:`,
          e.message
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
}

interface JustWatchOfferEdge {
  node: {
    content: {
      fullPath: string;
      title: string;
      originalReleaseYear?: number | string;
      posterUrl?: string | null;
      externalIds?: { tmdbId?: string | number };
    };
    offers?: JustWatchOffer[];
  };
}

interface TMDBResult {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
}

export const searchMovie = async (req: Request, res: Response): Promise<void> => {
  const title = (req.body as { title?: string; year?: string | number; country?: string })
    .title;
  const year = (req.body as { year?: string | number }).year;
  const countryCode = (req.body as { country?: string }).country;
  const [, country] = (countryCode || "es_UY").split("_");
  const language = "en";

  try {
    if (!title) {
      console.log("No movie title");
      res.json({ message: "Movie not found", title, year });
      return;
    }

    const cacheKey = `search-movie:${title}:${year}:${country}`;
    const cachedResponse = await getCacheValue(cacheKey);

    if (cachedResponse) {
      console.log("Response found (cached)");
      res.json(cachedResponse as object);
      return;
    }

    const movieDbAPIKey = process.env.MOVIE_DB_API_KEY;
    const encodedTitle = encodeURIComponent(title);
    const movieDbResponse = await axios.get(
      `${PROXY}https://api.themoviedb.org/3/search/movie?query=${encodedTitle}${year ? `&year=${year}` : ""}&api_key=${movieDbAPIKey}`
    );

    const results = (movieDbResponse.data as { results?: TMDBResult[] }).results;
    const movieDbData = results?.[0];

    if (!movieDbData) {
      const response = {
        error: "Movie not found (TMDB)",
        title,
        year,
        poster: "/movie_placeholder.svg",
      };
      await setCacheValue(cacheKey, response, cacheTtl, "list");
      res.json(response);
      return;
    }

    const tmdbId = movieDbData.id;
    const tmdbPoster = movieDbData.poster_path
      ? `https://image.tmdb.org/t/p/w500${movieDbData.poster_path}`
      : null;

    let justWatchResponse: { data: { data: { popularTitles: { edges: JustWatchOfferEdge[] } } } };
    try {
      const query = `
        query GetSuggestedTitles($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) {
          popularTitles(country: $country, first: $first, filter: $filter) {
            edges {
              node {
                id
                objectType
                objectId
                content(country: $country, language: $language) {
                  fullPath
                  title
                  originalReleaseYear
                  posterUrl
                  fullPath
                  scoring {
                    imdbScore
                    __typename
                  }
                  externalIds {
                    imdbId
                    tmdbId
                    __typename
                  }
                  __typename
                }
                offers(country: $country, platform: WEB) {
                  monetizationType
                  availableToTime
                  availableFromTime
                  standardWebURL
                  package {
                    clearName
                    technicalName
                    icon
                  }
                }
                __typename
              }
              __typename
            }
            __typename
          }
        }
      `;

      const variables = {
        country,
        language,
        first: 4,
        filter: { searchQuery: title },
      };

      justWatchResponse = await justWatchPost(
        axios,
        `${PROXY}https://apis.justwatch.com/graphql`,
        { query, variables }
      );
    } catch (error) {
      console.error(`JustWatch API error for ${title}:`, (error as Error).message);
      const response = {
        error: "JustWatch API unavailable",
        title: movieDbData.title || title,
        year: movieDbData.release_date?.substring(0, 4) || year,
        poster: tmdbPoster,
      };
      await setCacheValue(cacheKey, response, CACHE_TTL_UNAVAILABLE, "list");
      res.json(response);
      return;
    }

    const edges = justWatchResponse.data.data.popularTitles.edges;
    const movieData = edges.find(
      (edge) => String(edge.node.content.externalIds?.tmdbId) === String(tmdbId)
    );

    if (!movieData) {
      const response = {
        error: "Movie not found in JustWatch",
        title: movieDbData.title || title,
        year: movieDbData.release_date?.substring(0, 4) || year,
        poster: tmdbPoster,
      };
      await setCacheValue(cacheKey, response, cacheTtl, "list");
      res.json(response);
      return;
    }

    const poster = movieData.node.content.posterUrl
      ? `https://images.justwatch.com${movieData.node.content.posterUrl.replace("{profile}", "s592").replace("{format}", "jpg")}`
      : tmdbPoster;

    const noStreamingServicesResponse = {
      error: `No streaming services offering this movie on your country (${country})\n\npssst! try clicking pirate flags like these 🏴‍☠️`,
      title: movieData.node.content.title,
      year: movieData.node.content.originalReleaseYear,
      poster,
    };

    if (!movieData.node.offers || !movieData.node.offers.length) {
      await setCacheValue(cacheKey, noStreamingServicesResponse, cacheTtl, "list");
      res.json(noStreamingServicesResponse);
      return;
    }

    const canonicalMap = req.app.locals.canonicalProviderMap ?? {};
    const providers = processOffers(
      movieData.node.offers as JustWatchOffer[],
      movieData.node.content.fullPath,
      canonicalMap
    );

    if (!providers?.length) {
      await setCacheValue(cacheKey, noStreamingServicesResponse, cacheTtl, "list");
      res.json(noStreamingServicesResponse);
      return;
    }

    const responsePayload = {
      message: "Movie found",
      movieProviders: providers,
      title: movieData.node.content.title,
      year: movieData.node.content.originalReleaseYear,
      poster,
    };

    await setCacheValue(cacheKey, responsePayload, cacheTtl, "list");
    res.json(responsePayload);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Internal Server Error", title, year });
  }
};
