const axios = require("../helpers/axios");

const searchMovie = async (req, res) => {
  try {
    console.log("got here api/search-movie");
    const { title, year } = req.body;
    const countryCode = req.body.country || "es_UY";

    if (!title) {
      console.log("No movie title");
      res.status(404).json({ message: "Movie not found" });
      return;
    }

    const movieDbAPIKey = process.env.MOVIE_DB_API_KEY;
    const PROXY = "";

    // Search for movie on MovieDB API
    const movieDbResponse = await axios.get(
      `${PROXY}https://api.themoviedb.org/3/search/movie?query=${title}${
        year ? `&year=${year}` : ""
      }&api_key=${movieDbAPIKey}`
    );
    const movieDbData = movieDbResponse.data.results[0];

    if (!movieDbData) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }

    // Get title and year from MovieDB API
    const movieId = movieDbData.id;

    // Search for movie on JustWatch API using title and year
    const justWatchResponse = await axios.get(
      `${PROXY}https://api.justwatch.com/content/titles/${countryCode}/popular?body={"query": "${title} ${year}"}`
    );

    // Search for movie data in the JustWatch response based on the movie ID from MovieDB API
    // This is done to filter out movies JustWatch "suggests" but are not necessarily the same movie
    const movieData = justWatchResponse.data.items.find((item) => {
      const tmdbId = item.scoring.find(
        (score) => score.provider_type === "tmdb:id"
      );
      return tmdbId && tmdbId.value === movieId;
    });

    if (!movieData) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }

    if (!movieData.offers || !movieData.offers.length) {
      res.status(404).json({
        error: "No streaming services offering this movie (JustWatch)",
      });
      return;
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

    // Get clear names for streaming services
    const providerResponse = await axios.get(
      `${PROXY}https://apis.justwatch.com/content/providers/locale/${countryCode}`
    );
    const providers = providerResponse.data;
    const clearNames = streamingServices
      .map((service) => {
        const provider = providers.find((provider) => provider.id === service);
        return provider ? provider.clear_name : null;
      })
      .filter((name) => name !== null);

    if (!clearNames || !clearNames.length) {
      res.status(404).json({
        error: `Unable to identify providers offering media. Provider id(s): ${streamingServices.join(
          ", "
        )} (JustWatch)`,
      });
      return;
    }

    res.status(200).json({
      message: "Movie found",
      streamingServices: clearNames,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { searchMovie };
