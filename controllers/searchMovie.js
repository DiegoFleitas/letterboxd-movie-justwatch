import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper();
import { getCacheValue, setCacheValue } from "../helpers/redis.js";
import { processOffers } from "../helpers/processOffers.js";

const cacheTtl = process.env.CACHE_TTL || 3600; // 1h (seconds)
const CACHE_TTL_UNAVAILABLE = 120; // 2 min for "API unavailable" so retries can succeed sooner
const JUSTWATCH_TIMEOUT_MS = 15000;
const JUSTWATCH_RETRIES = 3;
const PROXY = "";

async function justWatchPost(axiosInstance, url, body) {
  let lastError;
  for (let attempt = 1; attempt <= JUSTWATCH_RETRIES; attempt++) {
    try {
      const res = await axiosInstance.post(url, body, {
        timeout: JUSTWATCH_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Letterboxd-Movie-JustWatch/1.0",
        },
      });
      return res;
    } catch (err) {
      lastError = err;
      const isRetryable =
        !err.response ||
        err.response.status >= 500 ||
        err.response.status === 429 ||
        err.code === "ECONNABORTED" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ENOTFOUND" ||
        err.code === "ECONNRESET";
      if (attempt < JUSTWATCH_RETRIES && isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`JustWatch attempt ${attempt}/${JUSTWATCH_RETRIES} failed, retrying in ${delay}ms:`, err.message);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
}

// TODO: refactor - way more complex than it needs to be
export const searchMovie = async (req, res) => {
  try {
    const { title, year, country: countryCode } = req.body;
    const [, country] = (countryCode || "es_UY").split("_");
    const language = "en"; // hardcoded for now

    if (!title) {
      console.log("No movie title");
      return res.json({ message: "Movie not found", title: title, year: year });
    }

    const cacheKey = `search-movie:${title}:${year}:${country}`;
    const cachedResponse = await getCacheValue(cacheKey);

    if (cachedResponse) {
      console.log("Response found (cached)");
      return res.json(cachedResponse);
    }

    const movieDbAPIKey = process.env.MOVIE_DB_API_KEY;
    let encodedTitle = encodeURIComponent(title);
    const movieDbResponse = await axios.get(
      `${PROXY}https://api.themoviedb.org/3/search/movie?query=${encodedTitle}${year ? `&year=${year}` : ""
      }&api_key=${movieDbAPIKey}`
    );

    const movieDbData = movieDbResponse.data.results[0];

    if (!movieDbData) {
      const response = {
        error: "Movie not found (TMDB)",
        title: title,
        year: year,
        poster: "/movie_placeholder.svg",
      };
      await setCacheValue(cacheKey, response, cacheTtl, "list");
      return res.json(response);
    }

    const tmdbId = movieDbData.id;
    const tmdbPoster = movieDbData.poster_path 
      ? `https://image.tmdb.org/t/p/w500${movieDbData.poster_path}`
      : null;

    let justWatchResponse;
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
        country: country,
        language: language,
        first: 4,
        filter: { searchQuery: title },
      };

      justWatchResponse = await justWatchPost(
        axios,
        `${PROXY}https://apis.justwatch.com/graphql`,
        { query, variables }
      );
    } catch (error) {
      console.error(`JustWatch API error for ${title}:`, error.message);
      // Return TMDB poster even if JustWatch fails
      const response = {
        error: "JustWatch API unavailable",
        title: movieDbData.title || title,
        year: movieDbData.release_date?.substring(0, 4) || year,
        poster: tmdbPoster,
      };
      await setCacheValue(cacheKey, response, CACHE_TTL_UNAVAILABLE, "list");
      return res.json(response);
    }

    const edges = justWatchResponse.data.data.popularTitles.edges;
    const movieData = edges.find(
      (edge) => edge.node.content.externalIds.tmdbId == tmdbId
    );

    if (!movieData) {
      // Movie not in JustWatch, return TMDB poster at least
      const response = { 
        error: "Movie not found in JustWatch", 
        title: movieDbData.title || title, 
        year: movieDbData.release_date?.substring(0, 4) || year,
        poster: tmdbPoster
      };
      await setCacheValue(cacheKey, response, cacheTtl, "list");
      return res.json(response);
    }

    // Extract poster - prefer JustWatch, fallback to TMDB
    const poster = movieData.node.content.posterUrl 
      ? `https://images.justwatch.com${movieData.node.content.posterUrl.replace("{profile}", "s592").replace("{format}", "jpg")}`
      : tmdbPoster;

    const noStreamingServicesResponse = {
      error:
        `No streaming services offering this movie on your country (${country})\n\npssst! try clicking pirate flags like these 🏴‍☠️`,
      title: movieData.node.content.title,
      year: movieData.node.content.originalReleaseYear,
      poster,
    };

    if (!movieData.node.offers || !movieData.node.offers.length) {
      await setCacheValue(cacheKey, noStreamingServicesResponse, cacheTtl, "list");
      return res.json(noStreamingServicesResponse);
    }

    const canonicalMap = req.app.locals.canonicalProviderMap ?? {};
    const providers = processOffers(
      movieData.node.offers,
      movieData.node.content.fullPath,
      canonicalMap
    );

    if (!providers?.length) {
      await setCacheValue(cacheKey, noStreamingServicesResponse, cacheTtl, "list");
      return res.json(noStreamingServicesResponse);
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
      .json({ error: "Internal Server Error", title: title, year: year });
  }
};

const getProviders = async (country) => {
  const cacheKey = `justwatch-providers:${country}`;
  const cachedProviders = await getCacheValue(cacheKey);

  if (cachedProviders) {
    return cachedProviders;
  }

  try {
    const query = `
      query GetPackages($platform: Platform! = WEB, $country: Country!) {
        packages(country: $country, platform: $platform, includeAddons: false) {
          clearName
          id
          shortName
          technicalName
          packageId
          selected
          monetizationTypes
          __typename
        }
      }
    `;

    const data = {
      query,
      variables: { platform: "WEB", country: country },
    };

    const providersResponse = await axios.post(
      "https://apis.justwatch.com/graphql",
      data
    );

    const providers = providersResponse.data.data.packages.map((provider) => ({
      id: provider.id,
      clear_name: provider.clearName,
    }));

    const cacheTtl = 60 * 60 * 24 * 1; // cache for 1 day since providers don't change often
    await setCacheValue(cacheKey, providers, cacheTtl);
    return providers;
  } catch (error) {
    console.error(`Error fetching providers for ${country}:`, error);
    throw error;
  }
};
