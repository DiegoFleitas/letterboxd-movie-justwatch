import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HTTP_STATUS_NOT_FOUND } from "./httpStatusCodes.js";
import { getRuntimeConfigJs } from "./lib/runtimeConfigAsset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function registerFastifyStaticAndIndex(
  app: FastifyInstance,
  cachedIndexHtml: string | null,
): void {
  app.get("/", (_request, reply) => {
    if (!cachedIndexHtml) {
      reply.code(HTTP_STATUS_NOT_FOUND).send();
      return;
    }
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.send(cachedIndexHtml);
  });

  app.get("/runtime-config.js", (_request, reply) => {
    const runtimeConfigJs = getRuntimeConfigJs();
    if (!runtimeConfigJs) {
      reply.code(HTTP_STATUS_NOT_FOUND).send();
      return;
    }
    reply
      .header("Content-Type", "application/javascript; charset=utf-8")
      .header("Cache-Control", "no-store")
      .send(runtimeConfigJs);
  });

  const publicDistPath = path.join(__dirname, "..", "client", "dist");
  app.register(fastifyStatic, {
    root: publicDistPath,
    prefix: "/",
    // Vite emits content-hashed filenames into dist/assets/, so those bytes are
    // immutable — cache them for a year. index.html is served by the "/" route
    // above (not this plugin) and stays uncached so deploys are picked up.
    setHeaders(reply, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  });

  app.get("/movie_placeholder.svg", (_request, reply) =>
    reply.sendFile("movie_placeholder.svg", path.join(__dirname, "..", "client")),
  );
}
