import type { FastifyInstance } from "fastify";
import * as Sentry from "@sentry/node";
import { HTTP_API_PATHS } from "./routes.js";
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from "./httpStatusCodes.js";

export function registerFastifySentryTestRoute(app: FastifyInstance): void {
  app.get(HTTP_API_PATHS.sentryTest, async (request, reply) => {
    const mode = ((request.query as { mode?: string })?.mode ?? "throw").toLowerCase();
    if (mode === "response") {
      const err = new Error("Dummy BE Sentry test response error");
      if (Sentry.getClient()) {
        Sentry.captureException(err, {
          extra: {
            endpoint: HTTP_API_PATHS.sentryTest,
            mode,
            method: request.method,
            url: request.url,
          },
        });
      }
      reply.code(HTTP_STATUS_INTERNAL_SERVER_ERROR).send({
        error: "Dummy backend response error for Sentry testing",
      });
      return;
    }
    throw new Error("Dummy BE Sentry test throw");
  });
}
