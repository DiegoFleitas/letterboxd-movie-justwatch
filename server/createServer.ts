import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyFormbody from "@fastify/formbody";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logging } from "diegos-fly-logger/index.mjs";
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
import {
  isHealthy,
  clearCacheByCategory,
  disconnectRedis,
  isRedisDisabled,
} from "../helpers/redis.js";
import {
  getCanonicalProviderMap,
  getCanonicalProviderByNames,
} from "../helpers/loadCanonicalProviders.js";
import { getPosthog, shutdownPosthog } from "../lib/posthog.js";
import { injectPosthogConfig } from "../lib/injectPosthogConfig.js";
import type { HttpHandler, HttpRequestContext, HttpResponseContext } from "./httpContext.js";
import * as Sentry from "@sentry/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadIndexHtmlWithPosthog(): string | null {
  const distIndexPath = path.join(__dirname, "..", "public", "dist", "index.html");
  if (!fs.existsSync(distIndexPath)) return null;

  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  const html = fs.readFileSync(distIndexPath, "utf8");
  return injectPosthogConfig(html, posthogKey, posthogHost, getCanonicalProviderByNames());
}

export interface StartedServer {
  port: number;
  close: () => Promise<void>;
}

export interface CreatedServer {
  framework: "fastify";
  app: FastifyInstance;
  start: (port?: number) => Promise<StartedServer>;
}

export function createServer(): CreatedServer {
  {
    const app: FastifyInstance = Fastify({
      logger: true,
    });

    const canonicalProviderMap = getCanonicalProviderMap();
    (app as unknown as { locals?: { [key: string]: unknown } }).locals = {
      canonicalProviderMap,
    };

    const makeFastifyHandler =
      (handler: HttpHandler) =>
      async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const locals = ((app as unknown as { locals?: { [key: string]: unknown } }).locals ||
          {}) as { [key: string]: unknown };

        const reqContext: HttpRequestContext = {
          body: request.body ?? {},
          params: (request.params as Record<string, unknown>) ?? {},
          query: (request.query as Record<string, unknown>) ?? {},
          headers: (request.headers as Record<string, unknown>) ?? {},
          method: request.method,
          url: request.url,
          cookies: ((request as unknown as { cookies?: Record<string, unknown> }).cookies ??
            {}) as Record<string, unknown>,
          session: (request as unknown as { session?: unknown }).session ?? null,
          appLocals: {
            canonicalProviderMap: locals.canonicalProviderMap,
          },
        };

        const resContext: HttpResponseContext = {
          status(code: number): HttpResponseContext {
            reply.code(code);
            return this;
          },
          json(payload: unknown): void {
            reply.send(payload);
          },
          send(payload?: unknown): void {
            if (payload === undefined) {
              reply.send();
            } else {
              reply.send(payload);
            }
          },
          setHeader(name: string, value: string | number | readonly string[]): HttpResponseContext {
            reply.header(name, value);
            return this;
          },
        };

        await handler({ req: reqContext, res: resContext });
      };

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
      return reply.sendFile("movie_placeholder.svg", path.join(__dirname, "..", "public"));
    });

    const appSecretKey = process.env.APP_SECRET_KEY;
    if (!appSecretKey && process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET_KEY environment variable must be set in production.");
    }
    /** @fastify/session requires secret length ≥ 32 */
    const sessionSecret = appSecretKey || "dev-only-session-secret-do-not-use-in-production!!";

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

    app.addHook("onRequest", async (request, reply) => {
      await new Promise<void>((resolve, reject) => {
        logging(request.raw, reply.raw, (err?: unknown) => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve();
        });
      });
    });

    const setCacheControlFastify =
      (handler: HttpHandler) => async (request: FastifyRequest, reply: FastifyReply) => {
        reply.header("Cache-Control", "public, max-age=3600");
        await makeFastifyHandler(handler)(request, reply);
      };

    app.get("/healthcheck", async (_request, reply) => {
      reply.type("text/plain").send("OK");
    });

    app.get("/redis-healthcheck", async (_request, reply) => {
      if (isRedisDisabled()) {
        reply.type("text/plain").code(200).send("OK (Redis disabled)");
        return;
      }
      if (await isHealthy()) {
        reply.type("text/plain").code(200).send("OK");
      } else {
        reply.type("text/plain").code(500).send("Redis is not healthy");
      }
    });

    app.post("/api/search-movie", setCacheControlFastify(searchMovie));
    app.post("/api/poster", setCacheControlFastify(poster));
    app.post("/api/letterboxd-watchlist", setCacheControlFastify(letterboxdWatchlist));
    app.post("/api/letterboxd-custom-list", setCacheControlFastify(letterboxdCustomList));
    app.post("/api/letterboxd-list-from-csv", setCacheControlFastify(letterboxdListFromCsv));
    app.post("/api/letterboxd-poster", setCacheControlFastify(letterboxdPoster));
    app.post("/api/alternative-search", setCacheControlFastify(alternativeSearch));

    app.all("/api/proxy/*", makeFastifyHandler(proxy));

    app.post("/api/dev/clear-list-cache", async (_request, reply) => {
      if (process.env.NODE_ENV === "production") {
        reply.code(404).send({ error: "Not available in production" });
        return;
      }
      const result = await clearCacheByCategory("list");
      reply.send({ ok: true, ...result });
    });

    const posthog = getPosthog();
    app.setErrorHandler(async (err, request, reply) => {
      console.error(err);
      if (Sentry.getClient()) {
        Sentry.captureException(err, {
          extra: { method: request.method, url: request.url },
        });
      }
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
}
