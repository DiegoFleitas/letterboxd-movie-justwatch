const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.post("/api/helloworld", async (req, res) => {
  try {
    console.log("got here api/helloworld");
    const result = {
      title: req.body.title || "Yi Yi",
      year: req.body.year || "2000",
    };
    movie = JSON.stringify(result);
    res.json(movie);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/search-movie", async (req, res) => {
  try {
    console.log("got here api/search-movie");
    console.log(JSON.stringify(req, null, 2));
    console.log(JSON.stringify(res, null, 2));
    const movieTitle = req.query.title || "Yi Yi";
    const movieYear = req.query.year || "2000";

    if (!movieTitle) {
      console.log("No movie title");
      res.status(404).send({ message: "Movie not found" });
      return;
    }

    const movieDbAPIKey = "825f79451255ce112042331fc0cb7c03";
    const PROXY = "https://stark-woodland-93683.fly.dev/";

    // Search for movie on MovieDB API
    const movieDbResponse = await axios.get(
      `${PROXY}https://api.themoviedb.org/3/search/movie?query=${movieTitle}${
        movieYear ? `&year=${movieYear}` : ""
      }&api_key=${movieDbAPIKey}`
    );
    const movieDbData = movieDbResponse.data.results[0];

    if (!movieDbData) {
      res.status(404).send({ message: "Movie not found" });
      return;
    }

    // Get title and year from MovieDB API
    const moviedbTitle = movieDbData.title;
    const moviedbYear = movieDbData.release_date.substring(0, 4);
    const movieId = movieDbData.id;

    // Search for movie on JustWatch API using title and year
    const justWatchResponse = await axios.get(
      `${PROXY}https://api.justwatch.com/content/titles/${countryCode}/popular?body={"query": "${movieTitle} ${movieYear}"}`
    );
    const movieData = justWatchResponse.data.items.find((item) => {
      const tmdbId = item.scoring.find(
        (score) => score.provider_type === "tmdb:id"
      );
      return tmdbId && tmdbId.value === movieId;
    });

    if (!movieData) {
      res.status(404).send({ message: "Movie not found" });
      return;
    }

    const streamingServices = movieData.offers.map(
      (offer) => offer.provider_id
    );

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
    res.status(200).send({
      message: "Movie found",
      streamingServices: [...new Set(clearNames)],
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.listen(port, () => console.log(`HelloNode app listening on port ${port}!`));
