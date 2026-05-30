import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { HTTP_API_PATHS, HTTP_API_POSTHOG_PROXY_ROUTE, HTTP_API_PROXY_ROUTE } from "./routes.js";
import {
  searchMovie,
  poster,
  letterboxdWatchlist,
  letterboxdCustomList,
  letterboxdPoster,
  alternativeSearch,
  subdlSearch,
  proxy,
  posthogProxyHandler,
} from "./controllers/index.js";
import { isHealthy, isRedisDisabled } from "./lib/redis.js";
import { captureServerException } from "./lib/sentryCapture.js";
import type { FastifyHttpBinder } from "./fastifyHttpBridge.js";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_OK,
} from "./httpStatusCodes.js";
import rateLimit from "@fastify/rate-limit";

async function csrfGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.method !== "POST") return;
  if (request.headers["x-requested-by"] === "MovieJustWatch") return;
  await reply.code(HTTP_STATUS_BAD_REQUEST).send({ error: "Bad Request" });
}

export async function registerFastifyAppApi(
  app: FastifyInstance,
  binder: FastifyHttpBinder,
): Promise<void> {
  const { makeFastifyHandler, setCacheControlFastify } = binder;

  app.get("/healthcheck", async (_request, reply) => {
    reply.type("text/plain").send("OK");
  });

  app.get("/redis-healthcheck", async (_request, reply) => {
    if (isRedisDisabled()) {
      reply.type("text/plain").code(HTTP_STATUS_OK).send("OK (Redis disabled)");
      return;
    }
    if (await isHealthy()) {
      reply.type("text/plain").code(HTTP_STATUS_OK).send("OK");
    } else {
      reply.type("text/plain").code(HTTP_STATUS_INTERNAL_SERVER_ERROR).send("Redis is not healthy");
    }
  });

  await app.register(async function apiRoutes(api: FastifyInstance) {
    api.addHook("preHandler", csrfGuard);

    api.register(rateLimit, {
      max: 30,
      timeWindow: "1 minute",
      keyGenerator: (request) => {
        return (request.headers["fly-client-ip"] as string) ?? request.ip;
      },
      errorResponseBuilder: (_request, context) => ({
        error: "Too many requests, please try again later",
        statusCode: 429,
        retryAfter: context.after,
      }),
    });

    api.post(HTTP_API_PATHS.searchMovie, setCacheControlFastify(searchMovie));
    api.post(HTTP_API_PATHS.poster, setCacheControlFastify(poster));
    api.post(HTTP_API_PATHS.letterboxdWatchlist, setCacheControlFastify(letterboxdWatchlist));
    api.post(HTTP_API_PATHS.letterboxdCustomList, setCacheControlFastify(letterboxdCustomList));
    api.post(HTTP_API_PATHS.letterboxdPoster, setCacheControlFastify(letterboxdPoster));
    api.post(HTTP_API_PATHS.alternativeSearch, setCacheControlFastify(alternativeSearch));
    api.post(HTTP_API_PATHS.subdlSearch, setCacheControlFastify(subdlSearch));

    api.all(HTTP_API_PROXY_ROUTE, makeFastifyHandler(proxy));
  });

  await app.register(async function posthogRoutes(phApp: FastifyInstance) {
    await phApp.register(rateLimit, {
      max: 60,
      timeWindow: "1 minute",
      keyGenerator: (request) => {
        return (request.headers["fly-client-ip"] as string) ?? request.ip;
      },
      errorResponseBuilder: (_request, context) => ({
        error: "Too many requests, please try again later",
        statusCode: 429,
        retryAfter: context.after,
      }),
    });
    phApp.all(HTTP_API_POSTHOG_PROXY_ROUTE, makeFastifyHandler(posthogProxyHandler));
  });

  if (process.env.NODE_ENV !== "production") {
    app.get(HTTP_API_PATHS.sentryTest, async (request, reply) => {
      const mode = ((request.query as { mode?: string })?.mode ?? "throw").toLowerCase();
      if (mode === "response") {
        const err = new Error("Dummy BE Sentry test response error");
        captureServerException(err, {
          route: "sentry-test",
          extra: {
            endpoint: HTTP_API_PATHS.sentryTest,
            mode,
            method: request.method,
            url: request.url,
          },
        });
        reply.code(HTTP_STATUS_INTERNAL_SERVER_ERROR).send({
          error: "Dummy backend response error for Sentry testing",
        });
        return;
      }
      throw new Error("Dummy BE Sentry test throw");
    });
  }
}
