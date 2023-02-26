const axios = require("../helpers/axios");
const { getCacheValue, setCacheValue } = require("../helpers/redis");
const cacheTtl = process.env.CACHE_TTL || 3600; // 1h (seconds)

const wink = async (req, res) => {
  const { title, year } = req.body;

  jackettApiKey = process.env.JACKETT_API_KEY;
  // Make a request to the Jackett API to get search results
  // replace spaces in searchQuery with +
  const searchQuery = `${title} ${year}`.replace(" ", "+");

  try {
    const cacheKey = `jackett:${searchQuery}:`;
    const cachedResponse = await getCacheValue(cacheKey);
    if (cachedResponse) {
      const status = cachedResponse.error ? 404 : 200;
      console.log("Response found (cached)");
      res.status(status).json(cachedResponse);
      return;
    }

    const { data } = await axios.get(
      `https://j4cke77-4hd43d19pe6d5bt7.fly.dev/api/v2.0/indexers/all/results?Query=${searchQuery}&Category=2000&apikey=${jackettApiKey}`
    );
    const results = data.Results;
    console.log(results);

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
        message: "😉",
        text: `[${bestResult.Tracker}] ${bestResult.Title} - ${bestResult.Details}`,
        url: bestResult.Details,
      };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(200).json(response);
    } else {
      const response = { error: "No results found." };
      await setCacheValue(cacheKey, response, cacheTtl);
      res.status(404).json(response);
    }
  } catch (error) {
    // If there is an error, send an error response
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { wink };
