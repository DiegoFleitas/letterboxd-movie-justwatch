import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import type { FastifyHttpBinder } from "./fastifyHttpBridge.js";
import { registerDevHttpRoutes } from "./registerDevHttpRoutes.js";
import { registerFastifyAppApi } from "./registerFastifyAppApi.js";
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
        // 'unsafe-inline' is required by injectRuntimeConfig's inline <script> block.
        // To remove it, generate a per-request nonce and inject it into both the
        // CSP header and the script tag in buildIndexHtmlForClient.
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
        "connect-src": ["'self'", "https://ipapi.co", ...resolveSentryConnectSrc()],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await app.register(cors, {
    origin: false,
    methods: ["GET", "POST"],
  });

  registerFastifyStaticAndIndex(app, cachedIndexHtml);
  registerFastifySessionPlugins(app);

  app.removeContentTypeParser("text/plain");
  app.addContentTypeParser("text/plain", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });

  await registerFastifyAppApi(app, binder);
  registerDevHttpRoutes(app);
}
