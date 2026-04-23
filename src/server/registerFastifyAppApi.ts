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

export function registerFastifyAppApi(app: FastifyInstance, binder: FastifyHttpBinder): void {
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

  app.post(HTTP_API_PATHS.searchMovie, setCacheControlFastify(searchMovie));
  app.post(HTTP_API_PATHS.poster, setCacheControlFastify(poster));
  app.post(HTTP_API_PATHS.letterboxdWatchlist, setCacheControlFastify(letterboxdWatchlist));
  app.post(HTTP_API_PATHS.letterboxdCustomList, setCacheControlFastify(letterboxdCustomList));
  app.post(HTTP_API_PATHS.letterboxdPoster, setCacheControlFastify(letterboxdPoster));
  app.post(HTTP_API_PATHS.alternativeSearch, setCacheControlFastify(alternativeSearch));
  app.post(HTTP_API_PATHS.subdlSearch, setCacheControlFastify(subdlSearch));

  app.all(HTTP_API_PROXY_ROUTE, makeFastifyHandler(proxy));
}
