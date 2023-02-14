const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const multer = require("multer");
const AdmZip = require("adm-zip");
const csv = require("csv-parser");
const { Readable } = require("stream");

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
    const movie = {
      title: req.body.title,
      year: req.body.year,
    };
    res.json(movie);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/search-movie", async (req, res) => {
  try {
    console.log("got here api/search-movie");
    const movieTitle = req.body.title;
    const movieYear = req.body.year;
    const countryCode = req.body.country || "es_UY";

    if (!movieTitle) {
      console.log("No movie title");
      res.status(404).json({ message: "Movie not found" });
      return;
    }

    const movieDbAPIKey = "825f79451255ce112042331fc0cb7c03";
    const PROXY = "";

    // Search for movie on MovieDB API
    const movieDbResponse = await axios.get(
      `${PROXY}https://api.themoviedb.org/3/search/movie?query=${movieTitle}${
        movieYear ? `&year=${movieYear}` : ""
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
      `${PROXY}https://api.justwatch.com/content/titles/${countryCode}/popular?body={"query": "${movieTitle} ${movieYear}"}`
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
  const API_KEY = "dacba5fa";
  const movieTitle = req.body.title;
  const movieYear = req.body.year;
  try {
    if (!movieTitle) {
      console.log("No movie title");
      res.status(404).json({ message: "Movie not found" });
      return;
    }
    const response = await axios.get(
      `http://www.omdbapi.com/?t=${movieTitle}&y=${movieYear}&apikey=${API_KEY}`
    );
    const { Poster } = response.data;
    res.status(200).json({
      message: "Poster found",
      poster: Poster,
    });
  } catch (error) {
    console.log(err);
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

app.listen(port, () => console.log(`HelloNode app listening on port ${port}!`));
