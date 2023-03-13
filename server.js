const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const morgan = require("morgan");
require("dotenv").config();
const {
  searchMovie,
  poster,
  letterboxdWatchlist,
  alternativeSearch,
  proxy,
} = require("./controllers");
const { isHealthy } = require("./helpers/redis");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));

// Define a custom morgan format to log JSON to the client
morgan.format("json", function (tokens, req, res) {
  const logLevel = res.statusCode >= 400 ? "error" : "info";
  return `[${logLevel}] ${JSON.stringify(
    {
      ip: tokens["remote-addr"](req, res),
      userAgent: req.headers["user-agent"],
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      payload: JSON.stringify(req.body),
      contentType: req.headers["content-type"],
      responseTime: tokens["response-time"](req, res),
    },
    null,
    2
  )}`;
});

app.use(morgan("json")); // logs

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// healthcheck endpoint
app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});

// redis healthcheck endpoint
app.get("/redis-healthcheck", async (req, res) => {
  if (await isHealthy()) {
    res.status(200).send("OK");
  } else {
    res.status(500).send("Redis is not healthy");
  }
});

app.post("/api/search-movie", async (req, res) => {
  return searchMovie(req, res);
});

app.post("/api/poster", async (req, res) => {
  return poster(req, res);
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
    return letterboxdWatchlist(req, res);
  }
);

app.post("/api/alternative-search", async (req, res) => {
  return alternativeSearch(req, res);
});

app.all("/proxy/:url(*)", async (req, res) => {
  return proxy(req, res);
});

app.listen(port, () =>
  console.log(`app listening on port http://localhost:${port}`)
);
