import type { FastifyInstance } from "fastify";
import type { FastifyHttpBinder } from "./fastifyHttpBridge.js";
import { registerDevHttpRoutes } from "./registerDevHttpRoutes.js";
import { registerFastifyAppApi } from "./registerFastifyAppApi.js";
import { registerFastifySentryTestRoute } from "./registerFastifySentryTestRoute.js";
import { registerFastifySessionPlugins } from "./registerFastifySessionPlugins.js";
import { registerFastifyStaticAndIndex } from "./registerFastifyStaticAndIndex.js";

export function registerFastifyWiring(
  app: FastifyInstance,
  binder: FastifyHttpBinder,
  cachedIndexHtml: string | null,
): void {
  registerFastifyStaticAndIndex(app, cachedIndexHtml);
  registerFastifySessionPlugins(app);
  registerFastifyAppApi(app, binder);
  registerDevHttpRoutes(app);
  registerFastifySentryTestRoute(app);
}
