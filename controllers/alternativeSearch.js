import axiosHelper from "../helpers/axios.js";
const axios = axiosHelper();
import { getCacheValue, setCacheValue } from "../helpers/redis.js";

const cacheTtl = process.env.CACHE_TTL || 3600; // 1h (seconds)

export const alternativeSearch = async (req, res) => {
  const { title, year } = req.body;

  const jackettKey = process.env.JACKETT_API_KEY;
  const jackettEndpoint = process.env.JACKETT_API_ENDPOINT;

  try {
    // replace spaces in searchQuery with +
    let searchQuery = `${title} ${year}`.replace(/ /g, "+");

    const cacheKey = `jackett:${searchQuery}:`;
    const cachedResponse = await getCacheValue(cacheKey);
    if (cachedResponse) {
      const status = cachedResponse.error ? 404 : 200;
      console.log("Response found (cached)");
      return res.status(status).json(cachedResponse);
    }

    const categories = {
      film: 2000,
      // tv: 5000,
    };

    const baseUrl = `${jackettEndpoint}/api/v2.0/indexers/all/results?apikey=${jackettKey}&Category=${categories.film}`;
    let { data } = await axios.get(`${baseUrl}&Query=${searchQuery}`);
    let results = data.Results;
    if (results.length === 0) {
      console.log(
        `No results found, trying again without year (${title} ${year})`
      );
      // not all valid results for a film can be found when including the year in the search query
      searchQuery = `${title}`.replace(/ /g, "+");
      let { data } = await axios.get(
        `${baseUrl}&Query=${searchQuery}`
      );
      results = data.Results;
    }

    // Find the result with the most seeders
    let maxSeeders = 0;
    let bestResult = null;
    for (const result of results) {
      if (result.Seeders > maxSeeders) {
        maxSeeders = result.Seeders;
        bestResult = result;
      }
    }

    if (bestResult) {
      console.log(bestResult);
      const response = {
        message: "🏴‍☠️",
        text: `[${bestResult.Tracker}] ${bestResult.Title} - ${bestResult.Details}`,
        url: bestResult.Details,
        query: searchQuery,
        title: title,
        year: year,
      };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(200).json(response);
    } else {
      const response = { error: "No results found." };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(404).json(response);
    }
  } catch (error) {
    if (error?.response?.status === 401) {
      return res
        .status(401)
        .json({ error: "Alternative search temporarily disabled" });
    }

    // If there is an error, send an error response
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
