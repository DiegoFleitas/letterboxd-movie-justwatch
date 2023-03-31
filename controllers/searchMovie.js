import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper();
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const cacheTtl = process.env.CACHE_TTL || 3600; // 1h (seconds)
const PROXY = "";

export const searchMovie = async (req, res) => {
  try {
    const { title, year, country } = req.body;
    const countryCode = country || "es_UY";

    if (!title) {
      console.log("No movie title");
      return res.json({ message: "Movie not found", title: title, year: year });
    }

    const cacheKey = `search-movie:${title}:${year}:${countryCode}`;
    const cachedResponse = await getCacheValue(cacheKey);
    if (cachedResponse) {
      const status = cachedResponse.error ? 404 : 200;
      console.log("Response found (cached)");
      return res.status(status).json(cachedResponse);
    }

    const movieDbAPIKey = process.env.MOVIE_DB_API_KEY;

    // Search for movie on MovieDB API
    let encodedTitle = encodeURIComponent(title);
    const movieDbResponse = await axios.get(
      `${PROXY}https://api.themoviedb.org/3/search/movie?query=${encodedTitle}${
        year ? `&year=${year}` : ""
      }&api_key=${movieDbAPIKey}`
    );
    const movieDbData = movieDbResponse.data.results[0];

    if (!movieDbData) {
      const response = { error: "Movie not found", title: title, year: year };
      await setCacheValue(cacheKey, response, cacheTtl);
      return res.json(response);
    }

    // Get title and year from MovieDB API
    const movieId = movieDbData.id;

    // Search for movie on JustWatch API using title and year
    const titlesPromise = axios.get(
      `${PROXY}https://api.justwatch.com/content/titles/${countryCode}/popular?body={"query": "${encodedTitle} ${year}"}`
    );

    // Get providers list from JustWatch API
    const providersPromise = getProviders(countryCode);

    // parallelize requests
    const [justWatchResponse, providers] = await Promise.all([
      titlesPromise,
      providersPromise,
    ]);

    // Search for movie data in the JustWatch response based on the movie ID from MovieDB API
    // This is done to filter out movies JustWatch "suggests" but are not necessarily the movie we are looking for
    const movieData =
      justWatchResponse?.data?.items.find((item) => {
        // Unreleased movies might not have scoring
        const tmdbId = item.scoring?.find(
          (score) => score.provider_type === "tmdb:id"
        );
        return tmdbId && tmdbId.value === movieId;
      }) || null;

    if (!movieData) {
      const response = { error: "Movie not found", title: title, year: year };
      await setCacheValue(cacheKey, response, cacheTtl);
      return res.json(response);
    }

    const noStreamingServicesResponse = {
      error:
        "No streaming services offering this movie on your country (JustWatch)",
      title,
      year,
    };

    if (!movieData.offers || !movieData.offers.length) {
      await setCacheValue(cacheKey, noStreamingServicesResponse, cacheTtl);
      return res.json(noStreamingServicesResponse);
    }

    let streamingServices = movieData.offers
      .filter(
        (offer) =>
          offer.monetization_type === "flatrate" ||
          offer.monetization_type === "free" ||
          offer.monetization_type === "ads"
      )
      .map((offer) => offer.provider_id);
    streamingServices = [...new Set(streamingServices)];

    if (!streamingServices?.length) {
      await setCacheValue(cacheKey, noStreamingServicesResponse, cacheTtl);
      return res.json(noStreamingServicesResponse);
    }

    // use reduce to avoid iterating twice
    const { clearNames, iconsAndNames } = streamingServices.reduce(
      (acc, service) => {
        const provider = providers.find((provider) => provider.id === service);
        if (provider) {
          acc.clearNames.push(provider.clear_name);
          const icon = provider.icon_url.replace("{profile}", "");
          acc.iconsAndNames.push({
            name: provider.clear_name,
            icon: `https://www.justwatch.com/images${icon}s100/icon.webp`,
          });
        }
        return acc;
      },
      { clearNames: [], iconsAndNames: [] }
    );

    if (!clearNames || !clearNames.length) {
      const services = streamingServices.join(", ");
      const response = {
        error: `Unable to identify providers offering media. Provider id(s): ${services} (JustWatch)`,
        title: title,
        year: year,
      };
      console.log(response);
      await setCacheValue(cacheKey, response, cacheTtl);
      return res.json(response);
    }

    const response = {
      message: "Movie found",
      streamingServices: clearNames,
      iconsAndNames: iconsAndNames,
      title: title,
      year: year,
    };
    await setCacheValue(cacheKey, response, cacheTtl);
    res.json(response);
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ error: "Internal Server Error", title: title, year: year });
  }
};

const getProviders = async (countryCode) => {
  const cacheKey = `justwatch-providers:${countryCode}`;
  const cachedProviders = await getCacheValue(cacheKey);

  if (cachedProviders) {
    return cachedProviders;
  }

  try {
    const providersResponse = await axios.get(
      `${PROXY}https://apis.justwatch.com/content/providers/locale/${countryCode}`
    );
    const providers = providersResponse.data;
    providers?.map((elem) => {
      const { id, clear_name } = elem;
      return { id, clear_name };
    }) || [];
    // cache for 1 day since providers don't change often
    const cacheTtl = 60 * 60 * 24 * 1;
    await setCacheValue(cacheKey, providers, cacheTtl);
    return providers;
  } catch (error) {
    console.error(`Error fetching providers for ${countryCode}:`, error);
    throw error;
  }
};
