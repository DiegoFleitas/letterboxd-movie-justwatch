import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import type { FastifyHttpBinder } from "./fastifyHttpBridge.js";
import { registerDevHttpRoutes } from "./registerDevHttpRoutes.js";
import { registerFastifyAppApi } from "./registerFastifyAppApi.js";
import { registerFastifySentryTestRoute } from "./registerFastifySentryTestRoute.js";
import { registerFastifySessionPlugins } from "./registerFastifySessionPlugins.js";
import { registerFastifyStaticAndIndex } from "./registerFastifyStaticAndIndex.js";

function resolveSentryConnectSrc(): string[] {
  const dsn = process.env.SENTRY_DSN || "";
  if (!dsn) return [];
  try {
    const host = new URL(dsn).host;
    return [host];
  } catch {
    return [];
  }
}

export async function registerFastifyWiring(
  app: FastifyInstance,
  binder: FastifyHttpBinder,
  cachedIndexHtml: string | null,
): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.cdnfonts.com",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.cdnfonts.com", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "https:", "data:"],
        "connect-src": [
          "'self'",
          "https://ipapi.co",
          process.env.POSTHOG_HOST || "https://us.i.posthog.com",
          ...resolveSentryConnectSrc(),
        ],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: false,
    methods: ["GET", "POST"],
  });

  registerFastifyStaticAndIndex(app, cachedIndexHtml);
  registerFastifySessionPlugins(app);
  await registerFastifyAppApi(app, binder);
  registerDevHttpRoutes(app);
  registerFastifySentryTestRoute(app);
}
