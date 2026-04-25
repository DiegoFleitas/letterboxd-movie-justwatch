import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { HTTP_STATUS_NOT_FOUND } from "./httpStatusCodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function registerFastifyStaticAndIndex(
  app: FastifyInstance,
  cachedIndexHtml: string | null,
): void {
  app.get("/", async (_request, reply) => {
    if (!cachedIndexHtml) {
      reply.code(HTTP_STATUS_NOT_FOUND).send();
      return;
    }
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.send(cachedIndexHtml);
  });

  const publicDistPath = path.join(__dirname, "..", "client", "dist");
  void app.register(fastifyStatic, {
    root: publicDistPath,
    prefix: "/",
  });

  app.get("/movie_placeholder.svg", async (_request, reply) => {
    return reply.sendFile("movie_placeholder.svg", path.join(__dirname, "..", "client"));
  });
}
