const axios = require("../helpers/axios");

const wink = async (req, res) => {
  const { title, year } = req.body;

  jackettApiKey = process.env.JACKETT_API_KEY;
  // Make a request to the Jackett API to get search results
  // replace spaces in searchQuery with +
  const searchQuery = `${title} ${year}`.replace(" ", "+");

  try {
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
      res.status(200).json({
        message: "😉",
        text: `[${bestResult.Tracker}] ${bestResult.Title} - ${bestResult.Details}`,
        url: bestResult.Details,
      });
    } else {
      res.status(404).json({ error: "No results found." });
    }
  } catch (error) {
    // If there is an error, send an error response
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { wink };
