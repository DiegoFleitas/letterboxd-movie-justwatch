import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
import { getPosthog, shutdownPosthog } from "./lib/posthog.js";
import { injectPosthogConfig } from "./lib/injectPosthogConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

/** Wraps async route handlers so rejections are passed to Express error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Serve index.html with runtime-injected PostHog config (so Fly secrets work; they're not available at Docker build time)
const distIndexPath = path.join(__dirname, "public", "dist", "index.html");
function serveAppWithPosthogConfig(req, res, next) {
  if (!fs.existsSync(distIndexPath)) return next();
  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  const html = fs.readFileSync(distIndexPath, "utf8");
  const injected = injectPosthogConfig(html, posthogKey, posthogHost);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(injected);
}
app.get("/", serveAppWithPosthogConfig);

app.use(express.static("public/dist")); // serve static files that vite built

// SPA fallback: serve app (with injected config) for any non-file GET so client routes and PostHog work after refresh
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/healthcheck") || req.path.startsWith("/redis-healthcheck")) return next();
  serveAppWithPosthogConfig(req, res, next);
});

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

// PostHog: capture errors that propagate to the error middleware.
// Note: controllers that catch errors internally must call getPosthog().captureException(err) directly.
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

const server = app.listen(port, () =>
  console.log(`app listening on port http://localhost:${port}`)
);

// Graceful shutdown: stop accepting connections, flush queued PostHog events, then exit
const gracefulShutdown = async () => {
  server.close(async () => {
    try {
      await shutdownPosthog();
      process.exit(0);
    } catch (err) {
      console.error("Error during PostHog shutdown:", err);
      process.exit(1);
    }
  });
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
