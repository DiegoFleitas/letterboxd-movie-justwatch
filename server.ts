import express, { type Request, type Response, type NextFunction } from "express";
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
import { isHealthy, clearCacheByCategory, disconnectRedis } from "./helpers/redis.js";
import { getCanonicalProviderMap, getCanonicalProviderByNames } from "./helpers/loadCanonicalProviders.js";
import { getPosthog, shutdownPosthog } from "./lib/posthog.js";
import { injectPosthogConfig } from "./lib/injectPosthogConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const distIndexPath = path.join(__dirname, "public", "dist", "index.html");
let cachedIndexHtml: string | null = null;
if (fs.existsSync(distIndexPath)) {
  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  const html = fs.readFileSync(distIndexPath, "utf8");
  cachedIndexHtml = injectPosthogConfig(
    html,
    posthogKey,
    posthogHost,
    getCanonicalProviderByNames()
  );
}

function serveAppWithPosthogConfig(req: Request, res: Response, next: NextFunction): void {
  if (!cachedIndexHtml) return next();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(cachedIndexHtml);
}

app.get("/", serveAppWithPosthogConfig);

app.get("/movie_placeholder.svg", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "movie_placeholder.svg"));
});

app.use(express.static("public/dist"));

app.use(session);

app.locals.canonicalProviderMap = getCanonicalProviderMap();

app.use(logging);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/healthcheck", (_req, res) => {
  res.status(200).send("OK");
});

app.get(
  "/redis-healthcheck",
  asyncHandler(async (_req, res) => {
    if (await isHealthy()) {
      res.status(200).send("OK");
    } else {
      res.status(500).send("Redis is not healthy");
    }
  })
);

const setCacheControl = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  next();
};

app.post("/api/search-movie", setCacheControl, asyncHandler(searchMovie));
app.post("/api/poster", setCacheControl, asyncHandler(poster));
app.post("/api/letterboxd-watchlist", setCacheControl, asyncHandler(letterboxdWatchlist));
app.post("/api/letterboxd-custom-list", setCacheControl, asyncHandler(letterboxdCustomList));
app.post("/api/letterboxd-poster", setCacheControl, asyncHandler(letterboxdPoster));
app.post("/api/alternative-search", setCacheControl, asyncHandler(alternativeSearch));
app.all("/api/proxy/:url(*)", asyncHandler(proxy));

app.post(
  "/api/dev/clear-list-cache",
  asyncHandler(async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }
    const result = await clearCacheByCategory("list");
    res.json({ ok: true, ...result });
  })
);

app.get("*", serveAppWithPosthogConfig);

const posthog = getPosthog();
if (posthog) {
  setupExpressErrorHandler(posthog, app);
}

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(port, () =>
  console.log(`app listening on port http://localhost:${port}`)
);

const gracefulShutdown = async () => {
  server.close(async () => {
    try {
      await disconnectRedis();
      await shutdownPosthog();
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
