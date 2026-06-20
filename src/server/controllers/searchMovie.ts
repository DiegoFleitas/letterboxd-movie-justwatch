import type { HttpHandler, HttpResponseContext } from "../httpContext.js";
import type { AxiosInstance } from "axios";
import axiosHelper from "../lib/axios.js";
import { getCacheValue, setCacheValue } from "../lib/redis.js";
import { processOffers } from "../lib/processOffers.js";
import { searchMovieBodySchema, firstZodIssueMessage } from "../lib/apiSchemas.js";
import type { CanonicalProviderMap, JustWatchOffer } from "../lib/types/index.js";
import { getRandomScrapeUserAgent } from "../lib/scrapeUserAgent.js";
import { buildLetterboxdStableFilmLink } from "../lib/letterboxdStableFilmLink.js";
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_INTERNAL_SERVER_ERROR } from "../httpStatusCodes.js";
import { recordJustWatchHttpAttempt } from "../lib/justWatchOutbound.js";
import { captureServerException } from "../lib/sentryCapture.js";

const axios = axiosHelper();
const cacheTtl = Number(process.env.CACHE_TTL) || 3600;
const CACHE_TTL_UNAVAILABLE = 120;
/**
 * Shorter TTL for "movie not found" answers (TMDB miss or no JustWatch match).
 * These can flip to a real hit as upstream catalogs update, so we don't want to
 * pin a not-found for the full hour. A legit "no streaming services" answer is a
 * different case and keeps the full TTL.
 */
const CACHE_TTL_NOT_FOUND = 600;
/** Redis category for movie-search responses (must not reuse Letterboxd list page category `list`). */
const SEARCH_MOVIE_CACHE_CATEGORY = "search-movie";
const JUSTWATCH_TIMEOUT_MS = 15000;
const JUSTWATCH_RETRIES = 3;

async function justWatchPost(
  axiosInstance: AxiosInstance,
  url: string,
  body: object,
): Promise<JustWatchQueryResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= JUSTWATCH_RETRIES; attempt++) {
    try {
      const res = await axiosInstance.post(url, body, {
        timeout: JUSTWATCH_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": getRandomScrapeUserAgent(),
        },
      });
      return res as typeof res & {
        data: { data: { popularTitles: { edges: JustWatchOfferEdge[] } } };
      };
    } catch (err: unknown) {
      lastError = err;
      recordJustWatchHttpAttempt(err);
      const e = err as { response?: { status?: number }; code?: string; message?: string };
      // 429 is owned solely by the axios response interceptor (lib/axios.ts),
      // which retries with Retry-After respect. This loop retries only the
      // transient 5xx / network / timeout failures the interceptor doesn't
      // cover — overlapping on 429 here would compound both retry paths.
      const isRetryable =
        !e.response ||
        (e.response.status !== undefined &&
          e.response.status >= HTTP_STATUS_INTERNAL_SERVER_ERROR) ||
        e.code === "ECONNABORTED" ||
        e.code === "ETIMEDOUT" ||
        e.code === "ENOTFOUND" ||
        e.code === "ECONNRESET";
      if (attempt < JUSTWATCH_RETRIES && isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(
          `JustWatch attempt ${attempt}/${JUSTWATCH_RETRIES} failed, retrying in ${delay}ms:`,
          e.message,
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
}

type JustWatchQueryResponse = {
  data: { data: { popularTitles: { edges: JustWatchOfferEdge[] } } };
};

interface JustWatchOfferEdge {
  node: {
    content: {
      fullPath: string;
      title: string;
      originalReleaseYear?: number | string;
      posterUrl?: string | null;
      externalIds?: { tmdbId?: string | number; imdbId?: string | number };
    };
    offers?: JustWatchOffer[];
  };
}

function buildImdbLink(imdbId: string | number | null | undefined): string | undefined {
  if (!imdbId) return undefined;
  const id = String(imdbId).trim();
  if (!id) return undefined;
  return `https://www.imdb.com/title/${id}/`;
}

function buildTmdbLink(tmdbId: string | number | null | undefined): string | undefined {
  if (!tmdbId) return undefined;
  return `https://www.themoviedb.org/movie/${String(tmdbId)}/`;
}

interface TMDBResult {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const JUSTWATCH_QUERY = `
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

interface TmdbSearchResult {
  data: TMDBResult | undefined;
  tmdbLink: string | undefined;
  tmdbPoster: string | null;
  letterboxdStableLink: string | undefined;
}

async function searchTmdb(
  title: string,
  year: string | number | undefined,
): Promise<TmdbSearchResult> {
  const movieDbAPIKey = process.env.MOVIE_DB_API_KEY;
  const encodedTitle = encodeURIComponent(title);
  const yearParam = year ? `&year=${year}` : "";
  const movieDbResponse = await axios.get(
    `https://api.themoviedb.org/3/search/movie?query=${encodedTitle}${yearParam}&api_key=${movieDbAPIKey}`,
  );
  const results = (movieDbResponse.data as { results?: TMDBResult[] }).results;
  const movieDbData = results?.[0];
  const tmdbLink = movieDbData ? buildTmdbLink(movieDbData.id) : undefined;
  const tmdbPoster = movieDbData?.poster_path
    ? `https://image.tmdb.org/t/p/w500${movieDbData.poster_path}`
    : null;
  const letterboxdStableLink = movieDbData
    ? buildLetterboxdStableFilmLink(undefined, movieDbData.id)
    : undefined;
  return { data: movieDbData, tmdbLink, tmdbPoster, letterboxdStableLink };
}

function buildErrorResponse(params: {
  error: string;
  title: string;
  year: string | number | undefined;
  tmdbResult: TmdbSearchResult;
  cacheKey: string;
  cacheTtl: number;
  res: HttpResponseContext;
}): void {
  const { error, title, year, tmdbResult, cacheKey, cacheTtl, res } = params;
  const { data: tmdbData, tmdbPoster, tmdbLink, letterboxdStableLink } = tmdbResult;
  const response = {
    error,
    title: tmdbData?.title || title,
    year: tmdbData?.release_date?.substring(0, 4) || year,
    poster: tmdbPoster,
    ...(letterboxdStableLink ? { link: letterboxdStableLink } : {}),
    ...(tmdbLink ? { tmdbLink } : {}),
  };
  setCacheValue(cacheKey, response, cacheTtl, SEARCH_MOVIE_CACHE_CATEGORY);
  res.json(response);
}

function buildNoStreamingResponse(params: {
  title: string;
  year?: string | number | null;
  poster: string | null;
  letterboxdFallbackLink?: string;
  imdbLink?: string;
  tmdbLink?: string;
  country: string;
}): Record<string, unknown> {
  return {
    error: `Not available on any streaming service in your country (${params.country}). Try Alternative search on the film tile.`,
    title: params.title,
    year: params.year,
    poster: params.poster,
    ...(params.letterboxdFallbackLink ? { link: params.letterboxdFallbackLink } : {}),
    ...(params.imdbLink ? { imdbLink: params.imdbLink } : {}),
    ...(params.tmdbLink ? { tmdbLink: params.tmdbLink } : {}),
  };
}

async function executeJustWatchQuery(
  country: string,
  language: string,
  title: string,
): Promise<JustWatchQueryResponse> {
  const variables = { country, language, first: 4, filter: { searchQuery: title } };
  return justWatchPost(axios, `https://apis.justwatch.com/graphql`, {
    query: JUSTWATCH_QUERY,
    variables,
  });
}

function findMatchingJustWatchEdge(
  edges: JustWatchOfferEdge[],
  tmdbId: number,
): JustWatchOfferEdge | undefined {
  return edges.find((edge) => String(edge.node.content.externalIds?.tmdbId) === String(tmdbId));
}

export const searchMovie: HttpHandler = async ({ req, res }) => {
  const parsedBody = searchMovieBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({ error: firstZodIssueMessage(parsedBody.error) });
    return;
  }
  const { title, year: rawYear, country: countryCode } = parsedBody.data;
  const year = rawYear ?? undefined;
  const [, country] = (countryCode || "es_UY").split("_");
  const language = "en";

  try {
    const cacheKey = `search-movie:${title}:${year}:${country}`;
    const cachedResponse = await getCacheValue(cacheKey);

    if (isObjectLike(cachedResponse)) {
      console.log("Response found (cached)");
      res.json(cachedResponse);
      return;
    }

    const tmdbResult = await searchTmdb(title, year);
    if (!tmdbResult.data) {
      const response = { error: "Movie not found (TMDB)", title, year };
      await setCacheValue(cacheKey, response, CACHE_TTL_NOT_FOUND, SEARCH_MOVIE_CACHE_CATEGORY);
      res.json(response);
      return;
    }

    const tmdbId = tmdbResult.data.id;

    let justWatchResponse: JustWatchQueryResponse;
    try {
      justWatchResponse = await executeJustWatchQuery(country, language, title);
    } catch (error) {
      console.error(`JustWatch API error for ${title}:`, (error as Error).message);
      buildErrorResponse({
        error: "JustWatch API unavailable",
        title,
        year,
        tmdbResult,
        cacheKey,
        cacheTtl: CACHE_TTL_UNAVAILABLE,
        res,
      });
      return;
    }

    const edges = justWatchResponse.data.data.popularTitles.edges;
    const movieData = findMatchingJustWatchEdge(edges, tmdbId);

    if (!movieData) {
      buildErrorResponse({
        error: "Movie not found in JustWatch",
        title,
        year,
        tmdbResult,
        cacheKey,
        cacheTtl: CACHE_TTL_NOT_FOUND,
        res,
      });
      return;
    }

    const poster = movieData.node.content.posterUrl
      ? `https://images.justwatch.com${movieData.node.content.posterUrl.replace("{profile}", "s592").replace("{format}", "jpg")}`
      : tmdbResult.tmdbPoster;
    const imdbId = movieData.node.content.externalIds?.imdbId;
    const imdbLink = buildImdbLink(imdbId);
    const letterboxdFallbackLink = buildLetterboxdStableFilmLink(imdbId, tmdbId);

    if (!movieData.node.offers?.length) {
      const response = buildNoStreamingResponse({
        title: movieData.node.content.title,
        year: movieData.node.content.originalReleaseYear,
        poster,
        letterboxdFallbackLink,
        imdbLink,
        tmdbLink: tmdbResult.tmdbLink,
        country,
      });
      await setCacheValue(cacheKey, response, cacheTtl, SEARCH_MOVIE_CACHE_CATEGORY);
      res.json(response);
      return;
    }

    const canonicalMap: CanonicalProviderMap =
      (req.appLocals.canonicalProviderMap as CanonicalProviderMap | undefined) ?? {};
    const providers = processOffers(
      movieData.node.offers as JustWatchOffer[],
      movieData.node.content.fullPath,
      canonicalMap,
    );

    if (!providers?.length) {
      const response = buildNoStreamingResponse({
        title: movieData.node.content.title,
        year: movieData.node.content.originalReleaseYear,
        poster,
        letterboxdFallbackLink,
        imdbLink,
        tmdbLink: tmdbResult.tmdbLink,
        country,
      });
      await setCacheValue(cacheKey, response, cacheTtl, SEARCH_MOVIE_CACHE_CATEGORY);
      res.json(response);
      return;
    }

    const responsePayload = {
      message: "Movie found",
      movieProviders: providers,
      title: movieData.node.content.title,
      year: movieData.node.content.originalReleaseYear,
      poster,
      ...(letterboxdFallbackLink ? { link: letterboxdFallbackLink } : {}),
      ...(imdbLink ? { imdbLink } : {}),
      ...(tmdbResult.tmdbLink ? { tmdbLink: tmdbResult.tmdbLink } : {}),
    };

    await setCacheValue(cacheKey, responsePayload, cacheTtl, SEARCH_MOVIE_CACHE_CATEGORY);
    res.json(responsePayload);
  } catch (err) {
    console.error(err);
    captureServerException(err, {
      route: "search-movie",
      extra: { title, year, country: countryCode },
    });
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      error: "Internal Server Error",
      title,
      year,
    });
  }
};
