import Fastify, { type FastifyInstance } from "fastify";
import * as Sentry from "@sentry/node";
import { disconnectRedis } from "./lib/redis.js";
import { getCanonicalProviderMap } from "./lib/loadCanonicalProviders.js";
import { getPosthog, shutdownPosthog } from "./lib/posthog.js";
import { createFastifyHttpBinder } from "./fastifyHttpBridge.js";
import { buildIndexHtmlForClient } from "./buildIndexHtmlForClient.js";
import { registerFastifyWiring } from "./registerFastifyWiring.js";
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from "./httpStatusCodes.js";

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
  const app: FastifyInstance = Fastify({
    logger: true,
  });

  const canonicalProviderMap = getCanonicalProviderMap();
  (app as FastifyInstance & { locals?: { [key: string]: unknown } }).locals = {
    canonicalProviderMap,
  };

  const binder = createFastifyHttpBinder(app);
  const cachedIndexHtml = buildIndexHtmlForClient();
  registerFastifyWiring(app, binder, cachedIndexHtml);

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
      reply.code(HTTP_STATUS_INTERNAL_SERVER_ERROR).send({ error: "Internal Server Error" });
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
