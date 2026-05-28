import type { FastifyInstance } from "fastify";
import { HTTP_API_PATHS, HTTP_API_PROXY_ROUTE } from "./routes.js";
import {
  searchMovie,
  poster,
  letterboxdWatchlist,
  letterboxdCustomList,
  letterboxdPoster,
  alternativeSearch,
  subdlSearch,
  proxy,
} from "./controllers/index.js";
import { isHealthy, isRedisDisabled } from "./lib/redis.js";
import type { FastifyHttpBinder } from "./fastifyHttpBridge.js";
import { HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_OK } from "./httpStatusCodes.js";
import rateLimit from "@fastify/rate-limit";

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
    api.register(rateLimit, {
      max: 30,
      timeWindow: "1 minute",
      keyGenerator: (request) => {
        return request.ip;
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
}
