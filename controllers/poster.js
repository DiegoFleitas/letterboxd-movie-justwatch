const axios = require("../helpers/axios")();
const { getCacheValue, setCacheValue } = require("../helpers/redis");
const cacheTtl = process.env.CACHE_TTL || 60; // minutes

const poster = async (req, res) => {
  const omdbApiKey = process.env.OMDB_API_KEY;
  let { title, year } = req.body;
  const cacheKey = `poster:${title}:${year}`;
  try {
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      console.log("Poster found (cached)");
      return res.status(200).json({
        message: "Poster found",
        poster: cachedPoster,
      });
    }

    if (!title) {
      console.log("No movie title");
      return res.status(404).json({ error: "Movie not found" });
    }

    // composite title (ex: The Lost World: Jurassic Park)
    if (title.includes(":")) {
      title = title.split(":")[0];
    }

    let encodedTitle = encodeURIComponent(title);
    const response = await axios.get(
      `http://www.omdbapi.com/?t=${encodedTitle}&y=${year}&apikey=${omdbApiKey}`
    );

    if (!response || !response.data || response.data.Error) {
      const errorMessage = response?.data?.Error || "Movie not found";
      console.log("Movie not found", errorMessage);
      return res.status(404).json({ error: errorMessage });
    }

    let { Poster: poster, Year: respYear, Released: released } = response.data;
    // Unreleased movies might not have a poster
    if (!poster) {
      console.log(
        `Poster not found for ${title} (${respYear}) release status: ${released}`
      );
      return res.status(404).json({ error: "Poster not found" });
    }

    await setCacheValue(cacheKey, poster, cacheTtl);
    res.status(200).json({
      message: "Poster found",
      poster: poster,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { poster };
