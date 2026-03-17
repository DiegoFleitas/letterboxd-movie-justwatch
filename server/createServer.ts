import express, {
  type Application as ExpressApp,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyFormbody from "@fastify/formbody";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { setupExpressErrorHandler } from "posthog-node";
import { logging } from "diegos-fly-logger/index.mjs";
import { session } from "../middleware/index.js";
import {
  searchMovie,
  poster,
  letterboxdWatchlist,
  letterboxdCustomList,
  letterboxdListFromCsv,
  letterboxdPoster,
  alternativeSearch,
  proxy,
} from "../controllers/index.js";
import { isHealthy, clearCacheByCategory, disconnectRedis } from "../helpers/redis.js";
import {
  getCanonicalProviderMap,
  getCanonicalProviderByNames,
} from "../helpers/loadCanonicalProviders.js";
import { getPosthog, shutdownPosthog } from "../lib/posthog.js";
import { injectPosthogConfig } from "../lib/injectPosthogConfig.js";
import { createFastifyExpressAdapter } from "./expressAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Framework = "express" | "fastify";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function loadIndexHtmlWithPosthog(): string | null {
  const distIndexPath = path.join(__dirname, "..", "public", "dist", "index.html");
  if (!fs.existsSync(distIndexPath)) return null;

  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  const html = fs.readFileSync(distIndexPath, "utf8");
  return injectPosthogConfig(html, posthogKey, posthogHost, getCanonicalProviderByNames());
}

function createExpressApp(): ExpressApp {
  const app = express();

  const cachedIndexHtml = loadIndexHtmlWithPosthog();

  function serveAppWithPosthogConfig(_req: Request, res: Response, next: NextFunction): void {
    if (!cachedIndexHtml) return next();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(cachedIndexHtml);
  }

  app.get("/", serveAppWithPosthogConfig);

  app.get("/movie_placeholder.svg", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "movie_placeholder.svg"));
  });

  app.use(express.static("public/dist"));

  app.use(session);

  app.locals.canonicalProviderMap = getCanonicalProviderMap();

  app.use(logging);

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.get("/healthcheck", (_req, res) => {
    res.type("text/plain").status(200).send("OK");
  });

  app.get(
    "/redis-healthcheck",
    asyncHandler(async (_req, res) => {
      if (await isHealthy()) {
        res.type("text/plain").status(200).send("OK");
      } else {
        res.type("text/plain").status(500).send("Redis is not healthy");
      }
    }),
  );

  const setCacheControl = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    next();
  };

  app.post("/api/search-movie", setCacheControl, asyncHandler(searchMovie));
  app.post("/api/poster", setCacheControl, asyncHandler(poster));
  app.post("/api/letterboxd-watchlist", setCacheControl, asyncHandler(letterboxdWatchlist));
  app.post("/api/letterboxd-custom-list", setCacheControl, asyncHandler(letterboxdCustomList));
  app.post("/api/letterboxd-list-from-csv", setCacheControl, asyncHandler(letterboxdListFromCsv));
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
    }),
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

  return app;
}

export interface StartedServer {
  port: number;
  close: () => Promise<void>;
}

export interface CreatedServer<F extends Framework = Framework> {
  framework: F;
  app: F extends "express" ? ExpressApp : FastifyInstance;
  start: (port?: number) => Promise<StartedServer>;
}

export function createServer(options: { framework: Framework }): CreatedServer {
  if (options.framework === "express") {
    const app = createExpressApp();

    return {
      framework: "express",
      app,
      async start(portArg?: number): Promise<StartedServer> {
        const desiredPort = portArg ?? Number(process.env.PORT ?? 3000);

        const server = await new Promise<import("http").Server>((resolve, reject) => {
          const s = app.listen(desiredPort, () => resolve(s));
          s.on("error", reject);
        });

        const address = server.address();
        const actualPort =
          typeof address === "object" && address && "port" in address
            ? (address.port as number)
            : desiredPort;

        return {
          port: actualPort,
          async close() {
            await new Promise<void>((resolve, reject) => {
              server.close((err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            await disconnectRedis();
            await shutdownPosthog();
          },
        };
      },
    };
  }

  if (options.framework === "fastify") {
    const app: FastifyInstance = Fastify({
      logger: true,
    });

    const canonicalProviderMap = getCanonicalProviderMap();
    (app as unknown as { locals?: { [key: string]: unknown } }).locals = {
      canonicalProviderMap,
    };
    const adapt = createFastifyExpressAdapter(app);

    const cachedIndexHtml = loadIndexHtmlWithPosthog();

    app.get("/", async (_request, reply) => {
      if (!cachedIndexHtml) {
        reply.code(404).send();
        return;
      }
      reply.header("Content-Type", "text/html; charset=utf-8");
      reply.send(cachedIndexHtml);
    });

    const publicDistPath = path.join(__dirname, "..", "public", "dist");
    void app.register(fastifyStatic, {
      root: publicDistPath,
      prefix: "/",
    });

    app.get("/movie_placeholder.svg", async (_request, reply) => {
      return reply.sendFile(
        "movie_placeholder.svg",
        path.join(__dirname, "..", "public"),
      );
    });

    const appSecretKey = process.env.APP_SECRET_KEY;
    if (!appSecretKey && process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET_KEY environment variable must be set in production.");
    }
    const sessionSecret = appSecretKey || "dev-secret";

    void app.register(fastifyCookie, {
      secret: sessionSecret,
    });

    void app.register(fastifySession, {
      secret: sessionSecret,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    });

    void app.register(fastifyFormbody);

    app.addHook("onRequest", async () => {
      const loggerMiddleware = logging as unknown as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      await new Promise<void>((resolve) => {
        loggerMiddleware({} as Request, {} as Response, () => resolve());
      });
    });

    const setCacheControlFastify = (handler: ReturnType<typeof adapt>) => {
      return async (
        _request: import("fastify").FastifyRequest,
        reply: import("fastify").FastifyReply,
      ) => {
        reply.header("Cache-Control", "public, max-age=3600");
        await handler({} as never, reply);
      };
    };

    app.get("/healthcheck", async (_request, reply) => {
      reply.type("text/plain").send("OK");
    });

    app.get("/redis-healthcheck", async (_request, reply) => {
      if (await isHealthy()) {
        reply.type("text/plain").code(200).send("OK");
      } else {
        reply.type("text/plain").code(500).send("Redis is not healthy");
      }
    });

    app.post("/api/search-movie", setCacheControlFastify(adapt(searchMovie)));
    app.post("/api/poster", setCacheControlFastify(adapt(poster)));
    app.post("/api/letterboxd-watchlist", setCacheControlFastify(adapt(letterboxdWatchlist)));
    app.post("/api/letterboxd-custom-list", setCacheControlFastify(adapt(letterboxdCustomList)));
    app.post("/api/letterboxd-list-from-csv", setCacheControlFastify(adapt(letterboxdListFromCsv)));
    app.post("/api/letterboxd-poster", setCacheControlFastify(adapt(letterboxdPoster)));
    app.post("/api/alternative-search", setCacheControlFastify(adapt(alternativeSearch)));

    app.all("/api/proxy/*", adapt(proxy));

    app.post("/api/dev/clear-list-cache", async (_request, reply) => {
      if (process.env.NODE_ENV === "production") {
        reply.code(404).send({ error: "Not available in production" });
        return;
      }
      const result = await clearCacheByCategory("list");
      reply.send({ ok: true, ...result });
    });

    const posthog = getPosthog();
    app.setErrorHandler(async (err, _request, reply) => {
      console.error(err);
      if (posthog) {
        try {
          await posthog.capture({
            distinctId: "server-error",
            event: "server_error",
            properties: {
              message: (err as Error).message,
              name: (err as Error).name,
            },
          });
        } catch {
          // ignore PostHog errors
        }
      }
      if (!reply.raw.headersSent) {
        reply.code(500).send({ error: "Internal Server Error" });
      }
    });

    return {
      framework: "fastify",
      app,
      async start(portArg?: number): Promise<StartedServer> {
        const desiredPort = portArg ?? Number(process.env.PORT ?? 3000);

        await app.listen({ port: desiredPort, host: "0.0.0.0" });
        const address = app.server.address();
        const actualPort =
          typeof address === "object" && address && "port" in address
            ? (address.port as number)
            : desiredPort;

        return {
          port: actualPort,
          async close() {
            await app.close();
            await disconnectRedis();
            await shutdownPosthog();
          },
        };
      },
    };
  }

  throw new Error(`Unsupported framework: ${options.framework}`);
}
