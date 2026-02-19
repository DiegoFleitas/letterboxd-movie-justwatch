import express from "express";
import bodyParser from "body-parser";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();
import { setupExpressErrorHandler } from "posthog-node";
import { session } from "./middleware/index.js";
import { logging } from "diegos-fly-logger/index.mjs";
import {
  searchMovie,
  poster,
  letterboxdWatchlist,
  letterboxdCustomList,
  letterboxdPoster,
  alternativeSearch,
  proxy,
} from "./controllers/index.js";
import { isHealthy } from "./helpers/redis.js";
import { getPosthog } from "./lib/posthog.js";

const app = express();
const port = process.env.PORT || 3000;

/** Wraps async route handlers so rejections are passed to Express error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.use(express.static("public/dist")); // serve static files that vite built

// anonymous session
app.use(session);

// logging
app.use(logging);

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});

// redis healthcheck endpoint
app.get("/redis-healthcheck", asyncHandler(async (req, res) => {
  if (await isHealthy()) {
    res.status(200).send("OK");
  } else {
    res.status(500).send("Redis is not healthy");
  }
}));

// Middleware to set cache control header
const setCacheControl = (req, res, next) => {
  // let browsers cache response for 1h
  res.setHeader("Cache-Control", "public, max-age=3600");
  next();
};

app.post("/api/search-movie", setCacheControl, asyncHandler(async (req, res) => {
  return searchMovie(req, res);
}));

app.post("/api/poster", setCacheControl, asyncHandler(async (req, res) => {
  return poster(req, res);
}));

app.post("/api/letterboxd-watchlist", setCacheControl, asyncHandler(async (req, res) => {
  return letterboxdWatchlist(req, res);
}));

app.post("/api/letterboxd-custom-list", setCacheControl, asyncHandler(async (req, res) => {
  return letterboxdCustomList(req, res);
}));

app.post("/api/letterboxd-poster", setCacheControl, asyncHandler(async (req, res) => {
  return letterboxdPoster(req, res);
}));

app.post("/api/alternative-search", setCacheControl, asyncHandler(async (req, res) => {
  return alternativeSearch(req, res);
}));

app.all("/api/proxy/:url(*)", asyncHandler(async (req, res) => {
  return proxy(req, res);
}));

// PostHog: capture API errors when POSTHOG_KEY is set
const posthog = getPosthog();
if (posthog) {
  setupExpressErrorHandler(posthog, app);
}

// Final error middleware: send 500 JSON (after PostHog capture)
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, () =>
  console.log(`app listening on port http://localhost:${port}`)
);