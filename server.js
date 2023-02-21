const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const multer = require("multer");
const AdmZip = require("adm-zip");
const csv = require("csv-parser");
const { Readable } = require("stream");
const morgan = require("morgan");
require("dotenv").config();
const { getCacheValue, setCacheValue } = require("./redis");

const app = express();
const port = process.env.PORT || 3000;
const cacheTtl = process.env.CACHE_TTL || 60; // seconds

app.use(express.static("public"));

// Define a custom morgan format that logs request IP and request payload
morgan.token("payload", (req, res) => {
  return JSON.stringify(req.body);
});
const logFormat = `remote-addr\tresponse-time(ms)\tmethod\turl\tstatus\tpayload\treq[content-type]\treq[user-agent]
:remote-addr\t:response-time ms\t:method\t:url\t:status\t:payload\t:req[content-type]\t:req[user-agent]`;
app.use(morgan(logFormat)); // logs

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.post("/api/search-movie", async (req, res) => {
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
      res.status(404).json({ message: "Movie not found" });
      return;
    }

    // Get title and year from MovieDB API
    const moviedbTitle = movieDbData.title;
    const moviedbYear = movieDbData.release_date.substring(0, 4);
    const movieId = movieDbData.id;

    // Search for movie on JustWatch API using title and year
    const justWatchResponse = await axios.get(
      `${PROXY}https://api.justwatch.com/content/titles/${countryCode}/popular?body={"query": "${title} ${year}"}`
    );
    const movieData = justWatchResponse.data.items.find((item) => {
      const tmdbId = item.scoring.find(
        (score) => score.provider_type === "tmdb:id"
      );
      return tmdbId && tmdbId.value === movieId;
    });

    if (!movieData) {
      res.status(404).json({ message: "Movie not found" });
      return;
    }

    // FIXME: TypeError: Cannot read property 'map' of undefined
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
    res.status(200).json({
      message: "Movie found",
      streamingServices: [...new Set(clearNames)],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/poster", async (req, res) => {
  const omdbApiKey = process.env.OMDB_API_KEY;
  const { title, year } = req.body;
  const cacheKey = `poster:${title}:${year}`;
  try {
    const cachedPoster = await getCacheValue(cacheKey);
    if (cachedPoster) {
      console.log("Poster found (cached)");
      res.status(200).json({
        message: "Poster found",
        poster: cachedPoster,
      });
      return;
    }

    if (!title) {
      console.log("No movie title");
      res.status(404).json({ message: "Movie not found" });
      return;
    }
    const response = await axios.get(
      `http://www.omdbapi.com/?t=${title}&y=${year}&apikey=${omdbApiKey}`
    );
    const { Poster } = response.data;
    await setCacheValue(cacheKey, Poster, cacheTtl);
    res.status(200).json({
      message: "Poster found",
      poster: Poster,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Set up Multer storage and file filter
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/zip",
      "application/x-zip-compressed",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(file.mimetype);
      return cb(new Error("Only zip files are allowed"));
    }
    cb(null, true);
  },
});

// Endpoint to handle watchlist file upload
app.post(
  "/api/letterboxd-watchlist",
  upload.single("watchlist"),
  async (req, res) => {
    try {
      const file = req.file;

      // Load the zip file
      const zip = new AdmZip(file.buffer);

      // Search for the "watchlist.csv" file
      const zipEntries = zip.getEntries();
      const watchlistEntry = zipEntries.find(
        (entry) => entry.entryName === "watchlist.csv"
      );

      // If the file is found, parse it to JSON and send the data back in the response
      if (watchlistEntry) {
        const watchlistJson = [];
        zip.readAsTextAsync(watchlistEntry, (csvData) => {
          const stream = Readable.from(csvData);
          stream
            .pipe(csv())
            .on("data", (row) => {
              watchlistJson.push(row);
            })
            .on("end", () => {
              console.log(watchlistJson);
              res.json(watchlistJson);
            });
        });
      } else {
        // If the file is not found, send an error response
        res.status(400).json({ error: "Watchlist file not found" });
      }
    } catch (err) {
      // If there is an error, send an error response
      console.log(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post("/api/wink", async (req, res) => {
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
        wink: `[${bestResult.Tracker}] ${bestResult.Title} - ${bestResult.Details}`,
      });
    } else {
      res.status(404).json({ message: "No results found." });
    }
  } catch (error) {
    // If there is an error, send an error response
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () =>
  console.log(
    `justwatch-done-right app listening on port http://localhost:${port}`
  )
);
